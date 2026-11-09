"use client";

import { animate, m, useInView, useReducedMotion, useScroll, useSpring } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Tx } from "@/components/i18n/LocaleProvider";
import type { PolicyStatus, TimelineStep } from "@/lib/content";
import { formatDate } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Bar runs from 0 to the value with a counting percentage when it scrolls into view. */
export function PolicyProgress({ value, status }: { value: number; status: PolicyStatus }) {
  const t = useTranslations("policy");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setN(value); // eslint-disable-line react-hooks/set-state-in-effect -- reduced motion: jump straight to the value
      return;
    }
    const c = animate(0, value, { duration: 1.4, ease: EASE, onUpdate: (v) => setN(Math.round(v)) });
    return () => c.stop();
  }, [inView, value, reduce]);
  return (
    <div ref={ref} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={t("progressAria")}>
      <div className="mb-2 flex items-end justify-between">
        <span className="font-display text-4xl font-bold tabular-nums text-strong">
          {n}
          <span className="text-xl text-muted">%</span>
        </span>
        <span className="text-sm text-muted">{t(`state.${status}`)}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-surface-2">
        <m.div
          className="gold-shimmer h-full rounded-full bg-gradient-to-r from-brand-mid via-pink to-pink-400"
          initial={{ width: 0 }}
          animate={inView ? { width: `${value}%` } : undefined}
          transition={{ duration: reduce ? 0 : 1.4, ease: EASE }}
        />
      </div>
    </div>
  );
}

/** Vertical timeline; the line draws itself as the reader scrolls through it. */
export function PolicyTimeline({ steps }: { steps: TimelineStep[] }) {
  const locale = useLocale();
  const ref = useRef<HTMLOListElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const draw = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });
  return (
    <ol ref={ref} className="relative space-y-5 pl-7">
      <span aria-hidden className="absolute bottom-1 left-[7px] top-1 w-0.5 rounded bg-line" />
      <m.span
        aria-hidden
        className="absolute bottom-1 left-[7px] top-1 w-0.5 origin-top rounded bg-gradient-to-b from-pink to-brand-mid"
        style={{ scaleY: reduce ? 1 : draw }}
      />
      {steps.map((s, i) => (
        <m.li
          key={i}
          className="relative"
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-30px" }}
          transition={{ duration: 0.45, delay: i * 0.06 }}
        >
          <span aria-hidden className="absolute -left-7 top-1.5 h-4 w-4 rounded-full border-[3px] border-surface bg-pink shadow-[0_0_0_3px_var(--c-pink-soft)]" />
          <time dateTime={s.date} className="text-xs font-semibold text-pink-ink">{formatDate(s.date, locale)}</time>
          <p className="text-sm text-ink"><Tx v={s.text} /></p>
        </m.li>
      ))}
    </ol>
  );
}
