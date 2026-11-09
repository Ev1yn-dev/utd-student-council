"use client";

import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/LocaleProvider";
import { FlagGB, FlagTH } from "@/components/icons/Flags";
import { Icon } from "@/components/icons/Icon";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

function Flag({ l }: { l: Locale }) {
  return l === "th" ? <FlagTH /> : <FlagGB />;
}

/**
 * Language control.
 * - default: 40 px glass globe button with the current code (TH/EN); opens a menu (scale + fade from the button's
 *   corner) listing the languages with flags; current one ticked on light pink. ↑/↓ move, Enter selects, ESC closes.
 * - variant "row": the two choices side by side (phone menu).
 */
export function LocaleSwitch({ variant = "button", compact, className }: { variant?: "button" | "row"; compact?: boolean; className?: string }) {
  const t = useTranslations("lang");
  const reduce = useReducedMotion();
  const { locale, switchLocale, switching } = useLocaleSwitch();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const locales = routing.locales;

  const choose = (l: Locale) => {
    setOpen(false);
    if (l !== locale) switchLocale(l);
  };

  useEffect(() => {
    if (!open) return;
    items.current[active]?.focus();
  }, [open, active]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  if (variant === "row") {
    return (
      <div role="radiogroup" aria-label={t("menu")} className={cn("grid grid-cols-2 gap-2", className)}>
        {locales.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={l === locale}
            disabled={switching}
            onClick={() => choose(l)}
            lang={l}
            className={cn(
              "flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition",
              compact ? "px-2 py-1 text-xs" : "px-3 py-2.5",
              l === locale ? "border-pink bg-pink-soft text-pink-ink" : "border-white/20 bg-white/5 text-on-brand hover:bg-white/10",
            )}
          >
            <Flag l={l} /> {compact ? l.toUpperCase() : t(l)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div ref={wrap} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t("button", { current: t(locale) })}
        disabled={switching}
        onClick={() => { setActive(Math.max(0, locales.indexOf(locale))); setOpen((o) => !o); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, locales.indexOf(locale))); setOpen(true); }
        }}
        className="group flex h-10 items-center gap-1.5 rounded-full border border-white/25 bg-white/10 pl-1 pr-2.5 text-on-brand backdrop-blur-md transition hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-glow"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
          <Icon name="globe" size={20} className="text-white" />
        </span>
        <span className="font-display text-xs font-semibold tracking-wide">{locale.toUpperCase()}</span>
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            id={menuId}
            role="menu"
            aria-label={t("menu")}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -4 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "top right" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") { e.preventDefault(); setOpen(false); wrap.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus(); }
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % locales.length); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + locales.length) % locales.length); }
              if (e.key === "Tab") setOpen(false);
            }}
            className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-[0_18px_40px_-16px_rgb(5_13_36/0.45)]"
          >
            {locales.map((l, i) => (
              <button
                key={l}
                ref={(el) => { items.current[i] = el; }}
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                tabIndex={i === active ? 0 : -1}
                lang={l}
                onClick={() => choose(l)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm outline-none transition-colors",
                  l === locale ? "bg-pink-soft font-semibold" : "hover:bg-gradient-to-r hover:from-sky hover:to-sky/30 focus-visible:bg-sky",
                )}
              >
                <Flag l={l} />
                <span className="flex-1">{t(l)}</span>
                <span className="text-xs font-semibold text-muted">{l.toUpperCase()}</span>
                {l === locale && <Icon name="check" size={16} weight="bold" className="text-pink-ink" />}
              </button>
            ))}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
