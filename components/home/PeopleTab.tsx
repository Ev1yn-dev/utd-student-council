"use client";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Advisor, Contact, Img, L, Member } from "@/lib/content";
import { COUNCIL_ROLES, groupByDepartment, type CouncilRole, type Department } from "@/lib/council";
import { DEPARTMENTS } from "@/lib/council-departments";
import { EmptyState } from "@/components/home/EmptyState";
import { CardItem, Lift, ZoneTitle } from "@/components/home/parts";
import { Tx, useL } from "@/components/i18n/LocaleProvider";
import { Modal } from "@/components/ui/Modal";
import { SmartImage } from "@/components/ui/SmartImage";
import { IconCrown, IconInstagram, IconMedal, IconStar, IconTeacher, IconUser, IconUsers } from "@/components/icons/Icon";
import { cn } from "@/lib/utils";

type Tone = "gold" | "navy" | "pink" | "sky" | "plain";
type Badge = { label: React.ReactNode; tone: Tone; icon: "crown" | "medal" | "star" | "user" };
type Person = {
  id: string; name: L; photo: Img | null; line: L; chip: React.ReactNode; badge: Badge | null;
  rows: [string, React.ReactNode][]; contact: Contact;
  /** whole introduction poster for the popup (council members who agreed to show their photo) */
  poster: Img | null;
};

/** Tag look per council role: built from the role, never typed by hand. */
const ROLE_TAG: Record<CouncilRole, { tone: Tone; icon: Badge["icon"] }> = {
  president: { tone: "gold", icon: "crown" },
  vice_president: { tone: "navy", icon: "medal" },
  head: { tone: "pink", icon: "star" },
  deputy_head: { tone: "sky", icon: "star" },
  member: { tone: "plain", icon: "user" },
};

export function PeopleTab({ kind, members, advisors, year, query, onClear }: {
  kind: "council" | "advisor"; members: Member[]; advisors: Advisor[]; year: number; query: string; onClear: () => void;
}) {
  const t = useTranslations("people");
  const count = kind === "council" ? members.length : advisors.length;
  return (
    <section aria-labelledby={`${kind}-h`}>
      <ZoneTitle icon={kind === "council" ? <IconUsers width={18} height={18} /> : <IconTeacher width={18} height={18} />} count={count}>
        <span id={`${kind}-h`}>{t(kind === "council" ? "council" : "advisors")}</span>
      </ZoneTitle>
      {count === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            <EmptyState key="empty" query={query} onClear={onClear} kind={kind} />
          </AnimatePresence>
        </div>
      ) : kind === "council" ? (
        <Council members={members} searching={!!query.trim()} />
      ) : (
        <Advisors advisors={advisors} year={year} />
      )}
    </section>
  );
}

// ───────────────────────── council: one section per department ─────────────────────────

function Council({ members, searching }: { members: Member[]; searching: boolean }) {
  const t = useTranslations("people");
  const pick = useL();
  const label = (d: Department) => pick({ th: d.th, en: d.en }).value;
  const [role, setRole] = useState<CouncilRole | null>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const other: Department = useMemo(() => ({ key: "other", th: t("otherDept"), en: t("otherDept"), pendingDeputies: 0 }), [t]);

  // chips list what this year has (placeholders count as deputy heads)
  const all = useMemo(() => groupByDepartment(members, DEPARTMENTS, other, !searching), [members, other, searching]);
  const roles = COUNCIL_ROLES.filter((r) => members.some((m) => m.councilRole === r) || (r === "deputy_head" && all.some((s) => s.pendingDeputies > 0)));
  const depts = all.map((s) => s.dept);

  const sections = groupByDepartment(
    members.filter((m) => !role || m.councilRole === role),
    DEPARTMENTS, other, !searching && (!role || role === "deputy_head"),
  ).filter((s) => !dept || s.dept.key === dept)
    .map((s) => (role && role !== "deputy_head" ? { ...s, pendingDeputies: 0 } : s))
    .filter((s) => s.people.length || s.pendingDeputies);

  const open = members.find((m) => m.id === openId) ?? null;
  let index = 0; // entrance stagger across sections

  return (
    <>
      <div className="mb-6 space-y-2.5">
        <ChipRow label={t("filterRole")}>
          {roles.map((r) => (
            <Chip key={r} on={role === r} onClick={() => setRole(role === r ? null : r)}>{t(`roles.${r}`)}</Chip>
          ))}
        </ChipRow>
        <ChipRow label={t("filterDept")}>
          {depts.map((d) => (
            <Chip key={d.key} on={dept === d.key} onClick={() => setDept(dept === d.key ? null : d.key)}>{label(d)}</Chip>
          ))}
        </ChipRow>
        {(role || dept) && (
          <button type="button" onClick={() => { setRole(null); setDept(null); }} className="text-sm font-medium text-pink-ink underline-offset-4 hover:underline">
            {t("clearFilters")}
          </button>
        )}
      </div>

      {sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-muted">{t("noMatch")}</p>
      ) : (
        <div className="space-y-9">
          {sections.map((s) => (
            <section key={s.dept.key} aria-labelledby={`dept-${s.dept.key}`}>
              <div className="mb-4 flex items-center gap-3">
                <h3 id={`dept-${s.dept.key}`} data-swap className="min-w-0 font-display text-[1.05rem] font-semibold leading-snug text-strong md:text-[1.2rem]">
                  {s.dept === other ? label(other) : t("deptHeading", { name: label(s.dept) })}
                </h3>
                <span aria-hidden className="dept-rule h-[3px] min-w-10 flex-1 rounded-full" />
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {s.people.map((m) => (
                    <CardItem key={m.id} index={index++}>
                      <MemberCard m={m} onOpen={() => setOpenId(m.id)} />
                    </CardItem>
                  ))}
                  {Array.from({ length: s.pendingDeputies }, (_, i) => (
                    <CardItem key={`${s.dept.key}-tba-${i}`} index={index++}>
                      <PendingCard />
                    </CardItem>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      <AnimatePresence>
        {open && (
          <Modal key={open.id} layoutId={`person-${open.id}`} title={t("popupTitle")} icon={<IconUser width={18} height={18} />} onClose={() => setOpenId(null)} size="lg">
            <MemberDetail m={open} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 sm:mx-0 sm:flex-wrap sm:px-0">
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        on ? "border-brand bg-brand text-on-brand shadow-soft" : "border-line bg-surface text-ink hover:border-brand-mid/40 hover:bg-sky",
      )}
    >
      {children}
    </button>
  );
}

function RoleTag({ role, className }: { role: CouncilRole; className?: string }) {
  const t = useTranslations("people");
  return <BadgeChip b={{ label: t(`roles.${role}`), ...ROLE_TAG[role] }} className={className} />;
}

function MemberCard({ m, onOpen }: { m: Member; onOpen: () => void }) {
  const t = useTranslations("people");
  const pick = useL();
  const president = m.councilRole === "president";
  const nick = pick(m.nickname).value;
  const role = pick(m.role).value;
  return (
    <Lift>
      <motion.article
        layoutId={`person-${m.id}`}
        style={{ borderRadius: 20 }}
        className={cn(
          "relative flex h-full flex-col gap-3 overflow-hidden border bg-surface p-3 shadow-soft transition-shadow duration-300 group-hover:shadow-lift sm:p-4",
          president ? "border-gold/70 bg-gradient-to-b from-gold-soft/60 to-surface ring-1 ring-gold/40" : "border-line",
        )}
      >
        <RoleTag role={m.councilRole} className="self-start" />
        <div className="grid flex-1 grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-1 sm:gap-3.5">
          <SmartImage
            img={m.photo}
            alt={nick ? t("photoAlt", { nickname: nick, role }) : pick(m.name).value}
            kind="portrait"
            label={m.photo ? undefined : t("photoPending")}
            sizes="(max-width: 640px) 112px, (max-width: 1024px) 50vw, 360px"
            className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-sky sm:mx-auto sm:max-w-[220px]"
            imgClassName="group-hover:scale-105"
          />
          <div className="flex min-w-0 flex-col gap-1 sm:items-center sm:text-center">
            {/* the whole card opens the popup (stretched button); the IG link sits above it */}
            <h4 className={cn("font-display font-semibold leading-snug text-strong", president ? "text-[1.08rem] sm:text-[1.15rem]" : "text-[0.98rem] sm:text-base")}>
              <button type="button" onClick={onOpen} aria-haspopup="dialog" className="text-left after:absolute after:inset-0 after:rounded-[20px] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-mid sm:text-center">
                <Name v={pick(m.name).value} />
              </button>
            </h4>
            {nick && <span className="text-[0.88rem] text-muted">{t("nickname")} {nick}</span>}
            <p className="text-[0.84rem] leading-snug text-ink"><Tx v={m.role} /></p>
            {m.party.th && <p className="text-[0.8rem] text-muted"><Tx v={m.party} /></p>}
            {m.instagram && (
              <a
                href={`https://instagram.com/${m.instagram}`}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={t("openInstagram", { name: nick || pick(m.name).value })}
                className="relative z-10 mt-1 inline-flex w-fit items-center gap-1.5 rounded-full px-1 py-0.5 text-[0.84rem] font-medium text-pink-ink hover:underline sm:mt-auto"
              >
                <IconInstagram width={15} height={15} /> @{m.instagram}
              </a>
            )}
          </div>
        </div>
      </motion.article>
    </Lift>
  );
}

/** Deputy head not announced yet (content/council-departments.json pendingDeputies). */
function PendingCard() {
  const t = useTranslations("people");
  return (
    <div className="flex h-full flex-col gap-3 rounded-[20px] border border-dashed border-line bg-surface/70 p-3 sm:p-4">
      <RoleTag role="deputy_head" className="self-start" />
      <div className="grid flex-1 grid-cols-[6.5rem_1fr] items-center gap-3 sm:grid-cols-1 sm:gap-3.5">
        <div className="grid aspect-[3/4] w-full place-items-center rounded-2xl border border-dashed border-line bg-surface-2 text-muted/70 sm:mx-auto sm:max-w-[220px]">
          <IconUser width={40} height={40} aria-hidden />
        </div>
        <p className="font-display font-semibold text-muted sm:text-center">{t("tba")}</p>
      </div>
    </div>
  );
}

/** Popup view of a council member. */
function MemberDetail({ m }: { m: Member }) {
  const t = useTranslations("people");
  const pick = useL();
  const has = (v: L) => !!v.th;
  return <PersonDetail p={{
    id: m.id, name: m.name, photo: m.photo, poster: m.poster, line: m.role, chip: null,
    badge: { label: t(`roles.${m.councilRole}`), ...ROLE_TAG[m.councilRole] },
    rows: [
      [t("nickname"), has(m.nickname) && pick(m.nickname).value], // names stay Thai: no "TH" badge
      [t("roleShort"), has(m.role) && <Tx v={m.role} />],
      [t("dept"), has(m.dept) && <Tx v={m.dept} />],
      [t("party"), has(m.party) && <Tx v={m.party} />],
    ],
    contact: { instagram: m.instagram, contact: m.contact },
  }} />;
}

// ───────────────────────── advisors ─────────────────────────

function Advisors({ advisors, year }: { advisors: Advisor[]; year: number }) {
  const t = useTranslations("people");
  const pick = useL();
  const has = (v: L) => !!v.th;
  const [openId, setOpenId] = useState<string | null>(null);
  const people: Person[] = advisors.map((a) => ({
    id: a.id, name: a.name, photo: a.photo, poster: null, line: has(a.subject) ? a.subject : a.position,
    chip: has(a.nickname) ? t("teacherChip", { nickname: pick(a.nickname).value }) : null,
    badge: { label: has(a.role) ? <Tx v={a.role} badge={false} /> : t("advisorRole"), tone: a.role.th.includes("หัวหน้า") ? "gold" : "navy", icon: "star" },
    rows: [
      [t("nickname"), has(a.nickname) && t("teacherChip", { nickname: pick(a.nickname).value })],
      [t("role"), has(a.role) && <Tx v={a.role} />],
      [t("subject"), has(a.subject) && <Tx v={a.subject} />],
      [t("position"), has(a.position) && <Tx v={a.position} />],
      [t("year"), String(year)],
    ],
    contact: { instagram: a.instagram, contact: a.contact },
  }));
  const open = people.find((p) => p.id === openId) ?? null;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        <AnimatePresence mode="popLayout">
          {people.map((p, i) => (
            <CardItem key={p.id} index={i}>
              <AdvisorCard p={p} onOpen={() => setOpenId(p.id)} />
            </CardItem>
          ))}
        </AnimatePresence>
      </ul>
      <AnimatePresence>
        {open && (
          <Modal key={open.id} layoutId={`person-${open.id}`} title={t("popupTitle")} icon={<IconUser width={18} height={18} />} onClose={() => setOpenId(null)} size="lg">
            <PersonDetail p={open} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function AdvisorCard({ p, onOpen }: { p: Person; onOpen: () => void }) {
  const pick = useL();
  return (
    <Lift>
      <motion.article
        layoutId={`person-${p.id}`}
        style={{ borderRadius: 20 }}
        className="h-full overflow-hidden border border-line bg-surface shadow-soft transition-shadow duration-300 group-hover:shadow-lift"
      >
        <button type="button" onClick={onOpen} aria-haspopup="dialog" className="flex h-full w-full flex-col text-left">
          <div className="relative">
            <SmartImage img={p.photo} alt={pick(p.name).value} kind="portrait" sizes="(max-width: 768px) 50vw, 320px" className="aspect-[3/4] w-full bg-sky" imgClassName="group-hover:scale-105" />
            {p.badge && <BadgeChip b={p.badge} className="absolute left-2.5 top-2.5" />}
          </div>
          <div className="flex flex-1 flex-col items-center gap-1 px-3 pb-4 pt-3 text-center">
            <h3 className="font-display text-[0.95rem] font-semibold leading-snug text-strong sm:text-base"><Name v={pick(p.name).value} /></h3>
            <p className="text-[0.82rem] leading-snug text-muted"><Tx v={p.line} /></p>
            {p.chip && <span className="mt-auto rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[0.72rem] font-medium text-ink">{p.chip}</span>}
          </div>
        </button>
      </motion.article>
    </Lift>
  );
}

// ───────────────────────── shared ─────────────────────────

/** A person's name (never translated): each word kept on one line, so a surname is not split in the middle. */
function Name({ v }: { v: string }) {
  return <>{v.split(" ").map((part, i) => <span key={i} className="whitespace-nowrap">{i > 0 && " "}{part}</span>)}</>;
}

function BadgeChip({ b, className }: { b: Badge; className?: string }) {
  const Icon = b.icon === "crown" ? IconCrown : b.icon === "medal" ? IconMedal : b.icon === "user" ? IconUser : IconStar;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold shadow-sm",
        b.tone === "gold" && "gold-shimmer bg-gradient-to-r from-[#b8901f] via-gold to-[#f1d77a] text-brand-deep",
        b.tone === "navy" && "bg-brand text-on-brand",
        b.tone === "pink" && "bg-pink-soft text-pink-ink ring-1 ring-pink/25",
        b.tone === "sky" && "bg-sky text-brand-mid ring-1 ring-brand-mid/20",
        b.tone === "plain" && "bg-surface-2 text-ink ring-1 ring-line",
        className,
      )}
    >
      <Icon width={13} height={13} aria-hidden /> {b.label}
    </span>
  );
}

function PersonDetail({ p }: { p: Person }) {
  const t = useTranslations("people");
  const pick = useL();
  const ig = p.contact.instagram;
  return (
    <div className="grid gap-6 p-5 sm:grid-cols-[5fr_7fr] sm:p-7">
      <div className="relative">
        <SmartImage
          img={p.poster ?? p.photo}
          alt={p.poster ? t("poster", { name: pick(p.name).value }) : pick(p.name).value}
          kind="portrait"
          sizes="(max-width: 640px) 100vw, 340px"
          className={cn("mx-auto w-full max-w-[340px] rounded-2xl bg-sky shadow-soft", p.poster ? "aspect-[4/5]" : "aspect-[3/4]")}
          priority
        />
        {/* the poster is shown as made: nothing drawn over it */}
        {p.badge && !p.poster && <BadgeChip b={p.badge} className="absolute left-3 top-3" />}
      </div>
      <div data-swap className="min-w-0">
        <h3 className="text-2xl font-bold text-strong"><Name v={pick(p.name).value} /></h3>
        <p className="mt-0.5 text-muted"><Tx v={p.line} /></p>
        <hr className="my-4 border-line" />
        <dl className="grid gap-2.5 text-[0.95rem]">
          {p.rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(8.5rem,auto)_1fr] gap-3">
              <dt className="font-medium text-muted">{k}</dt>
              <dd className="text-ink">{v || "-"}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-5 rounded-2xl border border-line bg-gradient-to-br from-sky/70 to-pink-soft/60 p-4">
          <p className="mb-2 font-display font-semibold text-strong">{t("contact")}</p>
          {ig || p.contact.contact ? (
            <div className="space-y-2">
              {ig && (
                <a
                  href={`https://instagram.com/${ig}`}
                  aria-label={t("openInstagram", { name: pick(p.name).value })}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-glow"
                >
                  <IconInstagram width={17} height={17} /> @{ig}
                </a>
              )}
              {p.contact.contact && <p className="whitespace-pre-line text-sm text-ink">{p.contact.contact}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("noContact")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
