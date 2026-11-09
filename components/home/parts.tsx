"use client";

import { m, useReducedMotion } from "motion/react";
import { useLocale } from "next-intl";
import { IconCalendar, IconChevronRight } from "@/components/icons/Icon";
import { Illustration } from "@/components/icons/Illustration";
import { cn, formatDate } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Grid/list item. The <li> only re-flows (layout) when filters change; the entrance (60 ms stagger, rise + fade)
 * runs on an inner element. Keeping the two transforms on different elements stops a card from being left
 * mid-animation above its neighbours.
 */
export function CardItem({ index, children, className }: { index: number; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <m.li
      layout={reduce ? false : "position"}
      className={className}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ layout: { duration: 0.35, ease: EASE } }}
    >
      <m.div
        className="h-full"
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "0px 0px -40px 0px" }}
        transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : Math.min(index, 12) * 0.06 }}
      >
        {children}
      </m.div>
    </m.li>
  );
}

/** Hover lift lives on this plain wrapper: motion writes inline transforms on layoutId elements, which would cancel it. */
export function Lift({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div data-swap className={cn("group h-full transition-transform duration-300 ease-out hover:-translate-y-1.5", className)}>{children}</div>;
}

export function ZoneTitle({ icon, children, count }: { icon: React.ReactNode; children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <h2 data-swap className="flex items-center gap-2.5 text-[1.15rem] font-semibold text-strong md:text-[1.35rem]">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-pink to-pink-400 text-white shadow-[0_6px_16px_-6px_var(--c-pink)]">{icon}</span>
        {children}
      </h2>
      {count !== undefined && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-medium text-muted">{count}</span>}
      <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-line to-transparent" />
    </div>
  );
}

export function DateChip({ iso, className }: { iso: string; className?: string }) {
  const locale = useLocale();
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[0.8rem] font-medium text-pink-ink", className)}>
      <IconCalendar width={14} height={14} />
      <time dateTime={iso}>{formatDate(iso, locale)}</time>
    </span>
  );
}

/**
 * Card without a photo: icon + meta line, title, 2-line excerpt, footer. Fills its grid cell so a row of
 * text cards has one height.
 */
export function TextCard({
  icon, meta, title, excerpt, footer, action, badge,
}: {
  icon: React.ReactNode; meta: React.ReactNode; title: React.ReactNode; excerpt?: string; footer?: React.ReactNode; action: string; badge?: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col gap-2.5 overflow-hidden p-5">
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-sky to-pink-soft opacity-70 transition-transform duration-500 group-hover:scale-125" />
      <Illustration name="decor-kaefarang" className="pointer-events-none absolute -bottom-4 -left-3 h-20 w-20 opacity-[0.12] transition-transform duration-500 group-hover:-rotate-6" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-mid text-white shadow-[0_8px_18px_-8px_var(--c-brand)]">{icon}</span>
        <div className="min-w-0 flex-1">{meta}</div>
        {badge}
      </div>
      <h3 className="relative line-clamp-2 font-display text-[1.05rem] font-semibold leading-snug text-strong">{title}</h3>
      {excerpt && <p className="relative line-clamp-2 text-sm text-muted">{excerpt}</p>}
      <div className="relative mt-auto flex min-h-7 items-center justify-between gap-3 pt-1">
        {footer ?? <span />}
        <span className="inline-flex shrink-0 items-center text-sm font-medium text-pink-ink transition-transform group-hover:translate-x-1">
          {action} <IconChevronRight width={16} height={16} />
        </span>
      </div>
    </div>
  );
}

/** Paragraphs of user text (plain text only — never HTML). */
export function Prose({ paragraphs, className }: { paragraphs: string[]; className?: string }) {
  return (
    <div className={cn("space-y-4 text-[0.98rem] leading-[1.9] text-ink/90", className)}>
      {paragraphs.map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
    </div>
  );
}
