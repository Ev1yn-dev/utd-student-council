"use client";

import { MessageSquareText } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLocaleSwitch } from "@/components/i18n/LocaleProvider";
import { Icon, type IconName } from "@/components/icons/Icon";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { CHANNELS } from "@/lib/contact";
import { cn } from "@/lib/utils";

type Key = "language" | (typeof CHANNELS)[number]["key"];
const ORDER: Key[] = ["language", "instagram", "facebook", "tiktok"];
const ICON: Record<Key, IconName> = { language: "globe", instagram: "instagram", facebook: "facebook", tiktok: "tiktok" };
const SPRING = { type: "spring", stiffness: 520, damping: 40 } as const;

/**
 * Phones (< md): the menu button opens a vertical rail under it, right-aligned: the "voice to the council" link
 * (always a capsule with its text), then 44 px round icons: language → Instagram → Facebook → TikTok. Tapping an icon stretches it into a capsule with its text
 * (one at a time; tapping again closes it). The capsule grows with a layout (transform) animation, so only the
 * compositor works. Closes on outside tap, Esc, scroll and page change. Reduced motion: no animation.
 */
export function MobileDock() {
  const t = useTranslations();
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const { locale, switchLocale, switching } = useLocaleSwitch();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Key | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const firstItem = useRef<HTMLAnchorElement>(null);
  const onVoice = /^\/(th|en)\/voice\/?$/.test(pathname);

  const close = (focusButton = false) => {
    setOpen(false);
    setActive(null);
    if (focusButton) button.current?.focus();
  };

  // close on page change (pathname is the only input; the effect only resets state when it changes)
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    setOpen(false);
    setActive(null);
  }

  useEffect(() => {
    if (!open) return;
    firstItem.current?.focus({ preventScroll: true });
    const outside = (e: PointerEvent) => wrap.current && !wrap.current.contains(e.target as Node) && close();
    // close when the page is really scrolled (focus / layout can fire a scroll event without moving)
    const startY = window.scrollY;
    const scroll = () => Math.abs(window.scrollY - startY) > 40 && close();
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", scroll);
    };
  }, [open]);

  const toggle = (k: Key) => setActive(active === k ? null : k);

  // light focus trap: Tab cycles between the menu button and the rail while it is open; Esc closes
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== "Tab" || !wrap.current) return;
    const items = Array.from(wrap.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]"));
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const label = (k: Key) => (k === "language" ? t("dock.language") : t(`contact.${k}`));
  const channel = (k: Key) => CHANNELS.find((c) => c.key === k);

  return (
    <div ref={wrap} className="relative md:hidden" onKeyDown={onKeyDown}>
      <button
        ref={button}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls="contact-dock"
        aria-label={t(open ? "lang.closeMenu" : "lang.openMenu")}
        className="relative grid h-11 w-11 place-items-center rounded-full border border-white/25 bg-white/10"
      >
        {/* three bars morph into an X */}
        {[-6, 0, 6].map((y, i) => (
          <motion.span
            key={i}
            aria-hidden
            className="absolute h-[2px] w-5 rounded-full bg-white"
            initial={false}
            animate={open ? (i === 1 ? { opacity: 0, scaleX: 0.2 } : { y: 0, rotate: i === 0 ? 45 : -45 }) : { y, rotate: 0, opacity: 1, scaleX: 1 }}
            transition={reduce ? { duration: 0 } : SPRING}
          />
        ))}
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id="contact-dock"
            aria-label={t("dock.label")}
            className="absolute right-0 top-full z-40 mt-2 flex w-[calc(100vw-2rem)] max-w-[22rem] flex-col items-end gap-2"
            initial="hidden"
            animate="shown"
            exit="hidden"
            variants={{ shown: { transition: reduce ? {} : { staggerChildren: 0.045 } }, hidden: { transition: reduce ? {} : { staggerChildren: 0.03, staggerDirection: -1 } } }}
          >
            <motion.li
              className="flex max-w-full justify-end"
              variants={{ hidden: { opacity: 0, y: -10, scale: 0.85 }, shown: { opacity: 1, y: 0, scale: 1 } }}
              transition={reduce ? { duration: 0 } : SPRING}
            >
              <Link
                ref={firstItem}
                href="/voice"
                aria-current={onVoice ? "page" : undefined}
                onClick={() => close()}
                className={cn(
                  "flex h-11 items-center gap-2 rounded-full border pl-4 pr-3 text-sm font-semibold shadow-[0_10px_24px_-10px_rgb(5_13_36/0.7)] backdrop-blur-md",
                  onVoice ? "border-pink-400/70 bg-pink-soft text-pink-ink" : "border-white/20 bg-brand-deep/95 text-on-brand",
                )}
              >
                <span>{t("header.voice")}</span>
                <span className="grid h-8 w-8 place-items-center"><MessageSquareText size={20} strokeWidth={1.75} aria-hidden /></span>
              </Link>
            </motion.li>
            {ORDER.map((k) => {
              const isOpen = active === k;
              const c = channel(k);
              return (
                <motion.li
                  key={k}
                  className="flex max-w-full justify-end"
                  variants={{ hidden: { opacity: 0, y: -10, scale: 0.85 }, shown: { opacity: 1, y: 0, scale: 1 } }}
                  transition={reduce ? { duration: 0 } : SPRING}
                >
                  <motion.div
                    layout={!reduce}
                    transition={SPRING}
                    style={{ borderRadius: 22 }}
                    className="flex max-w-full flex-row-reverse items-center overflow-hidden border border-white/20 bg-brand-deep/95 text-on-brand shadow-[0_10px_24px_-10px_rgb(5_13_36/0.7)] backdrop-blur-md"
                  >
                    <motion.button
                      layout={!reduce ? "position" : false}
                      type="button"
                      onClick={() => toggle(k)}
                      aria-expanded={isOpen}
                      aria-controls={`dock-${k}`}
                      aria-label={label(k)}
                      className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-full", isOpen && "bg-white/10")}
                    >
                      <Icon name={ICON[k]} size={20} className="text-white" />
                    </motion.button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          id={`dock-${k}`}
                          key="content"
                          layout={!reduce ? "position" : false}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 12 }}
                          transition={reduce ? { duration: 0 } : { duration: 0.18 }}
                          className="min-w-0 py-1.5 pl-4 pr-1 text-sm"
                        >
                          {k === "language" && (
                            <div role="group" aria-label={t("lang.menu")} className="flex items-center gap-1">
                              {routing.locales.map((l) => (
                                <button
                                  key={l}
                                  type="button"
                                  lang={l}
                                  disabled={switching}
                                  aria-pressed={l === locale}
                                  onClick={() => { close(); if (l !== locale) switchLocale(l); }}
                                  className={cn("h-9 rounded-full px-3 font-semibold", l === locale ? "bg-pink-soft text-pink-ink" : "hover:bg-white/10")}
                                >
                                  {t(`lang.${l}`)}
                                </button>
                              ))}
                            </div>
                          )}
                          {c && (
                            <a href={c.href} target="_blank" rel="noopener noreferrer nofollow" className="block truncate py-2 pr-2 font-semibold underline-offset-4 hover:underline">
                              {c.label}
                            </a>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>

    </div>
  );
}
