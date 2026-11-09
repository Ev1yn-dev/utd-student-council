"use client";

import { m, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { IconReset } from "@/components/icons/Icon";
import { Illustration } from "@/components/icons/Illustration";

/** Friendly "nothing here" box: a Kae Farang blossom holding a magnifier, bobbing gently. */
export function EmptyState({ query, onClear, kind }: { query?: string; onClear?: () => void; kind: "news" | "policy" | "council" | "advisor" }) {
  const t = useTranslations("empty");
  const reduce = useReducedMotion();
  const searching = !!query;
  return (
    <m.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      data-swap
      className="col-span-full mx-auto flex max-w-md flex-col items-center rounded-[20px] border border-dashed border-line bg-surface/70 px-6 py-10 text-center"
    >
      <m.div
        aria-hidden
        animate={reduce ? undefined : { y: [0, -6, 0], rotate: [0, -2, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <Illustration name="empty" className="h-32 w-auto" />
      </m.div>
      <p className="mt-3 font-display text-lg font-semibold text-strong">{searching ? t("notFound") : t(kind)}</p>
      <p className="mt-1 text-sm text-muted">
        {searching ? t("noResults", { q: query }) : t("forYear")}
      </p>
      {searching && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-display font-medium text-on-brand transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <IconReset width={18} height={18} /> {t("clear")}
        </button>
      )}
    </m.div>
  );
}
