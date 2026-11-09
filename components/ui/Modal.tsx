"use client";

import { m, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { IconClose } from "@/components/icons/Icon";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;
let openCount = 0; // nested popups (gallery fullscreen inside a popup) share one scroll lock

/** Locks page scroll while mounted; keeps the layout from jumping when the scrollbar disappears. */
export function useScrollLock() {
  useEffect(() => {
    const b = document.body;
    if (openCount++ === 0) {
      const gap = window.innerWidth - document.documentElement.clientWidth;
      b.style.overflow = "hidden";
      if (gap > 0) b.style.paddingRight = `${gap}px`;
    }
    return () => {
      if (--openCount === 0) {
        b.style.overflow = "";
        b.style.paddingRight = "";
      }
    };
  }, []);
}

/**
 * Popup. Render inside <AnimatePresence>. With `layoutId` equal to the clicked card's, the panel grows out of that card
 * and shrinks back into it on close (reduced motion: fade only). ESC, backdrop click and the close button close it;
 * background scroll is locked, focus moves into the dialog, Tab stays inside, focus returns to the card on close.
 * Phones (< 640px): full screen.
 */
export function Modal({
  title,
  icon,
  layoutId,
  onClose,
  children,
  size = "lg",
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  layoutId?: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "md" | "lg" | "xl";
}) {
  const t = useTranslations("common");
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useScrollLock();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus({ preventScroll: true });
    };
  }, [onClose]);

  const widths = { md: "sm:max-w-[640px]", lg: "sm:max-w-[820px]", xl: "sm:max-w-[1040px]" };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-6">
      <m.div
        aria-hidden
        className="absolute inset-0 bg-brand-deep/55 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        onClick={onClose}
      />
      <m.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        layoutId={reduce ? undefined : layoutId}
        initial={reduce || layoutId ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce || layoutId ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: reduce ? 0.2 : 0.45, ease: EASE }}
        style={{ borderRadius: 24 }}
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl max-sm:!rounded-none sm:h-auto sm:max-h-[min(92dvh,960px)]",
          widths[size],
        )}
      >
        <m.header
          layout="position"
          className="flex shrink-0 items-center gap-3 bg-gradient-to-r from-brand-deep via-brand to-brand-mid px-5 py-4 text-on-brand sm:px-6"
        >
          {icon && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/12 text-pink-400">{icon}</span>}
          <h2 data-swap id={titleId} className="min-w-0 flex-1 truncate text-[1.05rem] font-semibold sm:text-lg">{title}</h2>
          {/* the page header is behind the backdrop: switch language from here; the popup re-renders in place */}
          <LocaleSwitch variant="row" compact className="shrink-0" />
          <button
            ref={closeBtn}
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 transition hover:rotate-90 hover:bg-white/20"
          >
            <IconClose />
          </button>
        </m.header>
        <m.div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: reduce ? 0 : 0.18, duration: 0.3 } }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
        >
          {children}
        </m.div>
      </m.div>
    </div>,
    document.body,
  );
}
