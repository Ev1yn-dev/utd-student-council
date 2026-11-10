"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { AnimatePresence, m as mo } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { CARD_SIZE, councilImageLoader } from "@/lib/council-images";
import type { CouncilGroup, CouncilMember } from "@/lib/council-members";
import { EmptyState } from "@/components/home/EmptyState";
import { CardItem, Lift, ZoneTitle } from "@/components/home/parts";
import { IconInstagram, IconTeacher, IconUsers } from "@/components/icons/Icon";

// popup loads on first open
const Modal = dynamic(() => import("@/components/ui/Modal").then((r) => r.Modal));

type Section = { key: string; title: string; people: CouncilMember[]; level: 3 | 4 };

/**
 * Council tab: executives, then teacher advisors, then student members by department (departments in the order of
 * their first member). Advisor tab: the advisors only. A card opens a popup with the person's full introduction card.
 */
export function PeopleTab({ kind, people, query, onClear }: {
  kind: "council" | "advisor"; people: CouncilMember[]; query: string; onClear: () => void;
}) {
  const t = useTranslations("people");
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = kind === "council" ? people : people.filter((p) => p.group === "advisor");
  const sections = kind === "council" ? councilSections(shown, (g) => t(`groups.${g}`)) : [{ key: "advisor", title: "", people: shown, level: 3 as const }];
  const open = shown.find((p) => p.id === openId) ?? null;
  let index = 0; // entrance stagger across sections

  return (
    <section aria-labelledby={`${kind}-h`}>
      <ZoneTitle icon={kind === "council" ? <IconUsers width={18} height={18} /> : <IconTeacher width={18} height={18} />} count={shown.length}>
        <span id={`${kind}-h`}>{t(kind === "council" ? "council" : "advisors")}</span>
      </ZoneTitle>
      {shown.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            <EmptyState key="empty" query={query} onClear={onClear} kind={kind} />
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-9">
          {sections.map((s) => (
            <section key={s.key} aria-labelledby={s.title ? `ppl-${s.key}` : undefined} aria-label={s.title ? undefined : t("advisors")}>
              {s.title && <SectionTitle id={`ppl-${s.key}`} level={s.level}>{s.title}</SectionTitle>}
              {s.people.length > 0 && (
                <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {s.people.map((p) => (
                      <CardItem key={p.id} index={index++}>
                        <PersonCard p={p} onOpen={() => setOpenId(p.id)} />
                      </CardItem>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <Modal key={open.id} layoutId={`person-${open.id}`} title={<Name v={open.name} />} onClose={() => setOpenId(null)} size="md">
            <div className="p-3 sm:p-5">
              <Image
                loader={councilImageLoader}
                src={open.card}
                alt={open.name}
                width={CARD_SIZE.w}
                height={CARD_SIZE.h}
                sizes="(max-width: 640px) calc(100vw - 3rem), 560px"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                className="no-select mx-auto h-auto w-full max-w-[560px] rounded-2xl bg-sky shadow-soft"
              />
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
}

const GROUP_ORDER: CouncilGroup[] = ["executive", "advisor"];

function councilSections(people: CouncilMember[], label: (g: CouncilGroup) => string): Section[] {
  const out: Section[] = GROUP_ORDER.map((g) => ({ key: g, title: label(g), people: people.filter((p) => p.group === g), level: 3 as const }));
  // students by department; people come sorted by `order`, so a Map keeps the departments in that order
  const byDept = new Map<string, CouncilMember[]>();
  for (const p of people) {
    if (p.group !== "member") continue;
    const d = p.department ?? "";
    byDept.set(d, [...(byDept.get(d) ?? []), p]);
  }
  const depts = [...byDept].map(([d, list], i): Section => ({ key: `dept-${i}`, title: d, people: list, level: 4 }));
  if (depts.length) out.push({ key: "member", title: label("member"), people: [], level: 3 }, ...depts);
  return out.filter((s) => s.people.length || (s.key === "member" && depts.length));
}

function SectionTitle({ id, level, children }: { id: string; level: 3 | 4; children: React.ReactNode }) {
  const H = level === 3 ? "h3" : "h4";
  return (
    <div className="mb-4 flex items-center gap-3">
      <H id={id} className={level === 3
        ? "min-w-0 font-display text-[1.15rem] font-bold leading-snug text-strong md:text-[1.35rem]"
        : "min-w-0 font-display text-[1rem] font-semibold leading-snug text-strong md:text-[1.1rem]"}>
        {children}
      </H>
      <span aria-hidden className="dept-rule h-[3px] min-w-10 flex-1 rounded-full" />
    </div>
  );
}

function PersonCard({ p, onOpen }: { p: CouncilMember; onOpen: () => void }) {
  const t = useTranslations("people");
  return (
    <Lift>
      <mo.article
        layoutId={`person-${p.id}`}
        style={{ borderRadius: 20 }}
        className="relative flex h-full flex-col items-center gap-1.5 overflow-hidden border border-line bg-surface px-3 pb-4 pt-4 text-center shadow-soft transition-shadow duration-300 group-hover:shadow-lift"
      >
        <Image
          loader={councilImageLoader}
          src={p.avatar}
          alt={p.name}
          width={128}
          height={128}
          sizes="128px"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="no-select mb-1.5 size-24 rounded-full bg-sky object-cover ring-2 ring-line transition-transform duration-500 group-hover:scale-105 sm:size-28"
        />
        {/* the whole card opens the popup (stretched button); the IG link sits above it */}
        <p className="font-display text-[0.95rem] font-semibold leading-snug text-strong sm:text-base">
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            aria-label={t("openCard", { name: p.name })}
            className="after:absolute after:inset-0 after:rounded-[20px] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-mid"
          >
            <Name v={p.name} />
          </button>
        </p>
        {p.nickname && <span className="text-[0.85rem] text-muted">{t("nickname")} {p.nickname}</span>}
        <p className="text-[0.82rem] leading-snug text-ink">{p.role}</p>
        {p.party && (
          <span className="mt-0.5 rounded-full bg-pink-soft px-2.5 py-0.5 text-[0.72rem] font-semibold text-pink-ink ring-1 ring-pink/25">
            {p.party}
          </span>
        )}
        {p.instagramUrl && (
          <a
            href={p.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("openInstagram", { name: p.nickname || p.name })}
            className="relative z-10 mt-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-3 py-1 text-[0.8rem] font-semibold text-white transition-transform hover:-translate-y-0.5"
          >
            <IconInstagram width={15} height={15} aria-hidden /> {p.instagram ? `@${p.instagram}` : "Instagram"}
          </a>
        )}
      </mo.article>
    </Lift>
  );
}

/** A person's name: each word kept on one line, so a surname is not split in the middle. */
function Name({ v }: { v: string }) {
  return <>{v.split(" ").map((part, i) => <span key={i} className="whitespace-nowrap">{i > 0 && " "}{part}</span>)}</>;
}
