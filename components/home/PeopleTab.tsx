"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, m as mo } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { Contact, Img, L, Member } from "@/lib/content";
import { rosterPhoto } from "@/lib/council-images";
import type { CouncilGroup, CouncilMember } from "@/lib/council-members";
import { COUNCIL_ROLES, groupByDepartment, type CouncilRole, type Department } from "@/lib/council";
import { DEPARTMENTS } from "@/lib/council-departments";
import { EmptyState } from "@/components/home/EmptyState";
import { CardItem, Lift, ZoneTitle } from "@/components/home/parts";
import { Tx, useL } from "@/components/i18n/LocaleProvider";
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
  member: { tone: "plain", icon: "user" },
};

// popups load on first open
const Modal = dynamic(() => import("@/components/ui/Modal").then((r) => r.Modal));

/**
 * Council tab: the student committee (one section per department). Advisor tab: the school executives, then the
 * student council teacher advisors. Both use the same portrait card and popup.
 */
export function PeopleTab({ kind, members, staff, query, onClear }: {
  kind: "council" | "advisor"; members: Member[]; staff: CouncilMember[]; query: string; onClear: () => void;
}) {
  const t = useTranslations("people");
  const count = kind === "council" ? members.length : staff.length;
  return (
    <section aria-labelledby={`${kind}-h`}>
      <ZoneTitle icon={kind === "council" ? <IconUsers width={18} height={18} /> : <IconTeacher width={18} height={18} />} count={count}>
        <span id={`${kind}-h`}>{t(kind === "council" ? "council" : "staff")}</span>
      </ZoneTitle>
      {count === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
          <AnimatePresence mode="popLayout">
            <EmptyState key="empty" query={query} onClear={onClear} kind={kind} />
          </AnimatePresence>
        </div>
      ) : kind === "council" ? (
        <Council members={members} />
      ) : (
        <Staff staff={staff} />
      )}
    </section>
  );
}

// ───────────────────────── council: one section per department ─────────────────────────

function Council({ members }: { members: Member[] }) {
  const t = useTranslations("people");
  const pick = useL();
  const label = (d: Department) => pick({ th: d.th, en: d.en }).value;
  const [role, setRole] = useState<CouncilRole | null>(null);
  const [dept, setDept] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const other: Department = useMemo(() => ({ key: "other", th: t("otherDept"), en: t("otherDept") }), [t]);

  // chips list what this year has
  const all = useMemo(() => groupByDepartment(members, DEPARTMENTS, other), [members, other]);
  const roles = COUNCIL_ROLES.filter((r) => members.some((m) => m.councilRole === r));
  const depts = all.map((s) => s.dept);

  const sections = groupByDepartment(members.filter((m) => !role || m.councilRole === role), DEPARTMENTS, other)
    .filter((s) => !dept || s.dept.key === dept);

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
            <PersonSection key={s.dept.key} id={`dept-${s.dept.key}`} title={s.dept === other ? label(other) : t("deptHeading", { name: label(s.dept) })}>
              {s.people.map((m) => (
                <CardItem key={m.id} index={index++}>
                  <MemberCard m={m} onOpen={() => setOpenId(m.id)} />
                </CardItem>
              ))}
            </PersonSection>
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

/** A department (or staff group) heading over a grid of portrait cards. */
function PersonSection({ id, title, children }: { id: string; title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-4 flex items-center gap-3">
        <h3 id={id} data-swap className="min-w-0 font-display text-[1.05rem] font-semibold leading-snug text-strong md:text-[1.2rem]">
          {title}
        </h3>
        <span aria-hidden className="dept-rule h-[3px] min-w-10 flex-1 rounded-full" />
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">{children}</AnimatePresence>
      </ul>
    </section>
  );
}

/**
 * Portrait card shared by the committee and the staff: frame, portrait photo frame, name (the whole card opens the
 * popup), then the lines given as children (nickname, role, ...).
 */
function PortraitCard({ id, name, photo, alt, tag, featured, onOpen, children }: {
  id: string; name: string; photo: Img | null; alt: string; tag?: React.ReactNode; featured?: boolean; onOpen: () => void; children: React.ReactNode;
}) {
  const t = useTranslations("people");
  return (
    <Lift>
      <mo.article
        layoutId={`person-${id}`}
        style={{ borderRadius: 20 }}
        className={cn(
          "relative flex h-full flex-col gap-3 overflow-hidden border bg-surface p-3 shadow-soft transition-shadow duration-300 group-hover:shadow-lift sm:p-4",
          featured ? "border-gold/70 bg-gradient-to-b from-gold-soft/60 to-surface ring-1 ring-gold/40" : "border-line",
        )}
      >
        {tag}
        <div className="grid flex-1 grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-1 sm:gap-3.5">
          <SmartImage
            img={photo}
            alt={alt}
            kind="portrait"
            label={photo ? undefined : t("photoPending")}
            sizes="(max-width: 640px) 112px, (max-width: 1024px) 50vw, 360px"
            className="aspect-[3/4] w-full overflow-hidden rounded-2xl bg-sky sm:mx-auto sm:max-w-[220px]"
            imgClassName="group-hover:scale-105"
          />
          <div className="flex min-w-0 flex-col gap-1 sm:items-center sm:text-center">
            {/* the whole card opens the popup (stretched button); the IG link sits above it */}
            <h4 className={cn("font-display font-semibold leading-snug text-strong", featured ? "text-[1.08rem] sm:text-[1.15rem]" : "text-[0.98rem] sm:text-base")}>
              <button type="button" onClick={onOpen} aria-haspopup="dialog" className="text-left after:absolute after:inset-0 after:rounded-[20px] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-mid sm:text-center">
                <Name v={name} />
              </button>
            </h4>
            {children}
          </div>
        </div>
      </mo.article>
    </Lift>
  );
}

function MemberCard({ m, onOpen }: { m: Member; onOpen: () => void }) {
  const t = useTranslations("people");
  const pick = useL();
  const nick = pick(m.nickname).value;
  const role = pick(m.role).value;
  return (
    <PortraitCard
      id={m.id}
      name={pick(m.name).value}
      photo={m.photo}
      alt={nick ? t("photoAlt", { nickname: nick, role }) : pick(m.name).value}
      tag={<RoleTag role={m.councilRole} className="self-start" />}
      featured={m.councilRole === "president"}
      onOpen={onOpen}
    >
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
    </PortraitCard>
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

// ───────────────────────── executives, then teacher advisors (same card and popup as the committee) ─────────────────────────

const STAFF_GROUPS: CouncilGroup[] = ["executive", "advisor"];

function Staff({ staff }: { staff: CouncilMember[] }) {
  const t = useTranslations("people");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = staff.find((p) => p.id === openId) ?? null;
  const groups = STAFF_GROUPS.map((g) => ({ g, people: staff.filter((p) => p.group === g) })).filter((s) => s.people.length);
  let index = 0; // entrance stagger across sections
  return (
    <>
      <div className="space-y-9">
        {groups.map(({ g, people }) => (
          <PersonSection key={g} id={`staff-${g}`} title={t(`staffGroups.${g}`)}>
            {people.map((p) => (
              <CardItem key={p.id} index={index++}>
                <PortraitCard id={p.id} name={p.name} photo={rosterPhoto(p)} alt={p.name} onOpen={() => setOpenId(p.id)}>
                  <p className="text-[0.84rem] leading-snug text-ink">{p.role}</p>
                </PortraitCard>
              </CardItem>
            ))}
          </PersonSection>
        ))}
      </div>
      <AnimatePresence>
        {open && (
          <Modal key={open.id} layoutId={`person-${open.id}`} title={t("popupTitle")} icon={<IconUser width={18} height={18} />} onClose={() => setOpenId(null)} size="lg">
            <StaffDetail p={open} />
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

/** Roster text is Thai only. */
const thai = (th: string): L => ({ th, en: null });

/** Popup view of an executive or teacher advisor: the introduction card whole, name and role (no party / IG). */
function StaffDetail({ p }: { p: CouncilMember }) {
  const t = useTranslations("people");
  const photo = rosterPhoto(p);
  return <PersonDetail p={{
    id: p.id, name: thai(p.name), photo, poster: p.card ? photo : null, line: thai(p.role), chip: null, badge: null,
    rows: [[t("roleShort"), p.role]],
    contact: { instagram: null, contact: null },
  }} />;
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
          className={cn("mx-auto w-full max-w-[340px] rounded-2xl bg-sky shadow-soft", !p.poster && "aspect-[3/4]")}
          style={p.poster ? { aspectRatio: `${p.poster.w} / ${p.poster.h}` } : undefined}
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
          {p.rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(8.5rem,auto)_1fr] gap-3">
              <dt className="font-medium text-muted">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {(ig || p.contact.contact) && <div className="mt-5 rounded-2xl border border-line bg-gradient-to-br from-sky/70 to-pink-soft/60 p-4">
          <p className="mb-2 font-display font-semibold text-strong">{t("contact")}</p>
          {(
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
          )}
        </div>}
      </div>
    </div>
  );
}
