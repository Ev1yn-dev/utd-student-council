import type { L, YearContent } from "@/lib/content";

export type TabKey = "news" | "policy" | "council" | "advisor";
export const TAB_KEYS: TabKey[] = ["news", "policy", "council", "advisor"];
export const DEFAULT_TAB: TabKey = "news";
export const isTab = (v: unknown): v is TabKey => typeof v === "string" && (TAB_KEYS as string[]).includes(v);

/** Shareable URL for a tab/year; defaults are left out so the home page stays "/<locale>". */
export function homeHref(locale: string, tab: TabKey, year: number | null, currentYear: number) {
  const q = new URLSearchParams();
  if (tab !== DEFAULT_TAB) q.set("tab", tab);
  if (year && year !== currentYear) q.set("year", String(year));
  const s = q.toString();
  return `/${locale}${s ? `?${s}` : ""}`;
}

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
type Field = string | L | L<string[]> | null | undefined;
const text = (f: Field): string =>
  !f ? "" : typeof f === "string" ? f : [f.th, f.en].flat().filter(Boolean).join(" ");
/** Matches Thai and English versions at once, whatever language the page is shown in. */
const hit = (q: string, ...fields: Field[]) => fields.some((f) => norm(text(f)).includes(q));

/** Filters every tab at once (news title/body, policy, people name/nickname/positions/dept/party). */
export function filterContent(c: YearContent, query: string) {
  const q = norm(query);
  if (!q) return { ...c, q };
  return {
    ...c,
    q,
    announcements: c.announcements.filter((a) => hit(q, a.title, a.body)),
    activities: c.activities.filter((a) => hit(q, a.title, a.body)),
    policies: c.policies.filter((p) => hit(q, p.title, p.summary, p.owner, p.body)),
    members: c.members.filter((m) => hit(q, m.name, m.nickname, m.role, m.execTitle, m.dept, m.party, m.termNo)),
    staff: c.staff.filter((p) => hit(q, p.name, p.nickname, p.role)),
  };
}

/** Council tab: the student committee; advisor tab: the school executives and the teacher advisors. */
export const tabCount = (c: Pick<YearContent, "announcements" | "activities" | "policies" | "members" | "staff">, t: TabKey) =>
  t === "news" ? c.announcements.length + c.activities.length : t === "policy" ? c.policies.length
    : t === "council" ? c.members.length : c.staff.length;
