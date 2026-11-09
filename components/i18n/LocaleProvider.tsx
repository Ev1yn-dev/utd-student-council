"use client";

import { LazyMotion } from "motion/react";
import { NextIntlClientProvider, useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { L } from "@/lib/content";
import type { Locale } from "@/i18n/routing";
import { Icon } from "@/components/icons/Icon";
import { cn } from "@/lib/utils";

type Messages = Record<Locale, Record<string, unknown>>;

// motion features (animations, layout, gestures) arrive in their own chunk after the first render
const motionFeatures = () => import("@/components/motion-features").then((r) => r.default);
type Ctx = { locale: Locale; switching: boolean; switchLocale: (next: Locale) => void };
const LocaleCtx = createContext<Ctx | null>(null);

// Pages rendered on the server (back office, sign-in) switch language with a normal navigation; public pages switch
// in place so the open tab, popup and scroll position survive (both message bundles and both-language content are
// already in the browser; the URL is updated with history.replaceState).
const SERVER_RENDERED = /^\/(th|en)\/(dashboard|login|pending-access)(\/|$)/;
const COOKIE = "NEXT_LOCALE";

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < innerHeight && r.width > 0;
};
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const done = (a: Animation) => a.finished.then(() => undefined, () => undefined);

/**
 * Language switch, ~900 ms:
 * 1. navy overlay (#050D24, 85 %) + slight blur fades in (250 ms); the globe spins once and "Switching to …" rises
 * 2. while covered: the locale is swapped in place (both bundles are already loaded) and the URL updated with
 *    history.replaceState — tab, year, scroll position and an open popup all stay
 * 3. waits until the new text is really painted (fonts ready + two frames), not a guessed delay
 * 4. overlay fades out (300 ms) while the page's text blocks ([data-swap]) rise 8 px and fade in, top to bottom
 * Reduced motion: a short overlay fade only. Clicks during a switch are ignored.
 * Server-rendered pages (back office, sign-in) navigate to the other locale behind the overlay instead.
 */
export function LocaleProvider({ initial, messages, children }: { initial: Locale; messages: Messages; children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initial);
  const [switching, setSwitching] = useState(false);
  const [target, setTarget] = useState<Locale | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const pathname = usePathname();
  const router = useRouter();

  // a navigation to another locale (e.g. a link) re-renders this provider with a new `initial`
  const [seen, setSeen] = useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setLocale(initial);
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const switchLocale = useCallback(
    async (next: Locale) => {
      if (next === locale || busy.current) return;
      busy.current = true;
      setSwitching(true);
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const path = window.location.pathname.replace(/^\/(th|en)(?=\/|$)/, `/${next}`);
      const url = path + window.location.search + window.location.hash;
      document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;

      // 1. cover
      flushSync(() => setTarget(next));
      const el = overlay.current!;
      const spin = !reduce && el.querySelector<HTMLElement>("[data-globe]")?.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(360deg)" }], { duration: 650, easing: "cubic-bezier(.45,0,.2,1)" });
      if (!reduce) el.querySelector<HTMLElement>("[data-msg]")?.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 300, delay: 80, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
      await done(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduce ? 120 : 250, easing: "ease-out", fill: "both" }));

      if (SERVER_RENDERED.test(pathname)) {
        router.replace(url, { scroll: false }); // the new page replaces this provider (and the overlay)
        return;
      }

      // 2. swap behind the overlay
      const oldTitle = (messages[locale].meta as Record<string, string>).title;
      const newTitle = (messages[next].meta as Record<string, string>).title;
      flushSync(() => setLocale(next));
      window.history.replaceState(window.history.state, "", url);
      document.title = document.title.replace(oldTitle, newTitle);

      // 3. new text painted for real
      await document.fonts.ready;
      await frame();
      await frame();
      if (spin) await done(spin);

      // 4. reveal: overlay out, text blocks rise in top to bottom
      const blocks = reduce ? [] : Array.from(document.querySelectorAll<HTMLElement>("[data-swap]")).filter(visible).sort(
        (a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left,
      );
      const rise = blocks.map((b, i) => b.animate(
        [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }],
        { duration: 320, delay: 90 + Math.min(i, 14) * 22, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" },
      ));
      await Promise.all([done(el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduce ? 120 : 300, easing: "ease-in", fill: "both" })), ...rise.map(done)]);
      rise.forEach((a) => a.cancel());
      setTarget(null);
      busy.current = false;
      setSwitching(false);
    },
    [locale, messages, pathname, router],
  );

  const to = target ? (messages[target].lang as Record<string, string>) : null;
  return (
    <LocaleCtx.Provider value={{ locale, switching, switchLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="Asia/Bangkok">
        <LazyMotion features={motionFeatures}>{children}</LazyMotion>
      </NextIntlClientProvider>
      {target && to && (
        <div
          ref={overlay}
          role="status"
          aria-live="assertive"
          className="fixed inset-0 z-[300] grid place-items-center bg-[rgb(5_13_36/0.85)] text-white opacity-0 backdrop-blur-[6px]"
        >
          <div className="flex flex-col items-center gap-4" lang={target}>
            <span data-globe className="grid h-16 w-16 place-items-center rounded-full bg-white/10 shadow-[0_0_40px_rgb(242_122_168/0.35)]">
              <Icon name="globe" size={36} className="text-white" />
            </span>
            <p data-msg className="font-display text-lg font-semibold tracking-wide">{to.switching}</p>
          </div>
        </div>
      )}
    </LocaleCtx.Provider>
  );
}

export function useLocaleSwitch() {
  const c = useContext(LocaleCtx);
  if (!c) throw new Error("useLocaleSwitch outside LocaleProvider");
  return c;
}

/** Picks the current language from bilingual content; `fallback` = English requested but missing. */
export function useL() {
  const locale = useLocale();
  return useCallback(<T,>(v: L<T>) => {
    const fallback = locale === "en" && v.en === null;
    return { value: locale === "en" && v.en !== null ? v.en : v.th, fallback };
  }, [locale]);
}

/** Small "TH" label shown next to text that has no English version yet. */
export function ThBadge({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <span
      title={t("thOnlyTitle")}
      aria-label={t("thOnlyTitle")}
      className={cn("ml-1.5 inline-flex translate-y-[-1px] items-center rounded-[5px] border border-line bg-surface-2 px-1 align-middle font-sans text-[0.6rem] font-semibold leading-[1.35] tracking-wide text-muted", className)}
    >
      {t("thOnly")}
    </span>
  );
}

/** Bilingual text with the fallback label. */
export function Tx({ v, badge = true }: { v: L; badge?: boolean }) {
  const pick = useL();
  const { value, fallback } = pick(v);
  return (
    <>
      <span lang={fallback ? "th" : undefined}>{value}</span>
      {fallback && badge && <ThBadge />}
    </>
  );
}
