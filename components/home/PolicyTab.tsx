"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ViewTransition } from "react";
import type { Policy } from "@/lib/content";
import { EmptyState } from "@/components/home/EmptyState";
import { CardItem, Lift, TextCard, ZoneTitle } from "@/components/home/parts";
import { WideMedia } from "@/components/home/NewsTab";
import { Tx, useL } from "@/components/i18n/LocaleProvider";
import { IconChevronRight, IconFlag } from "@/components/icons/Icon";
import { StatusPill } from "@/components/ui/StatusPill";
import { Link } from "@/i18n/navigation";

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-brand-mid via-pink to-pink-400"
        initial={{ width: 0 }}
        whileInView={{ width: `${value}%` }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      />
    </div>
  );
}

/** Policies open a full page (/[locale]/policies/[slug]); with a cover the image morphs into that page's hero. */
export function PolicyTab({ policies, query, onClear }: { policies: Policy[]; query: string; onClear: () => void }) {
  const t = useTranslations("policy");
  const pick = useL();
  if (policies.length === 0) return <div className="grid"><EmptyState query={query} onClear={onClear} kind="policy" /></div>;
  return (
    <section aria-labelledby="pol-h">
      <ZoneTitle icon={<IconFlag width={18} height={18} />} count={policies.length}><span id="pol-h">{t("heading")}</span></ZoneTitle>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {policies.map((p, i) => {
            const cover = p.cover ?? p.photos[0] ?? null;
            const title = pick(p.title).value;
            return (
              <CardItem key={p.id} index={i} className={cover ? "col-span-full" : undefined}>
                <Lift>
                  <Link
                    href={`/policies/${p.slug}`}
                    aria-label={t("cardAria", { title })}
                    className="block h-full overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft transition-shadow duration-300 group-hover:shadow-lift"
                  >
                    {cover ? (
                      <WideMedia
                        photos={[cover]}
                        alt={title}
                        imageWrap={(img) => <ViewTransition name={`policy-${p.slug}`} share="morph" default="none">{img}</ViewTransition>}
                        caption={
                          <>
                            <StatusPill status={p.status} />
                            <span className="font-display font-medium text-strong"><Tx v={p.title} /></span>
                            <span className="inline-flex items-center text-sm text-pink-ink transition-transform group-hover:translate-x-1">
                              {t("details")} <IconChevronRight width={16} height={16} />
                            </span>
                          </>
                        }
                        footer={<Progress value={p.progress} />}
                      />
                    ) : (
                      <TextCard
                        icon={<IconFlag width={18} height={18} />}
                        meta={<StatusPill status={p.status} />}
                        badge={<span className="font-display text-sm font-semibold tabular-nums text-strong">{p.progress}%</span>}
                        title={<Tx v={p.title} />}
                        excerpt={pick(p.summary).value}
                        footer={<div className="w-24"><Progress value={p.progress} /></div>}
                        action={t("details")}
                      />
                    )}
                  </Link>
                </Lift>
              </CardItem>
            );
          })}
        </AnimatePresence>
      </ul>
    </section>
  );
}
