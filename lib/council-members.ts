import data from "@/src/data/council-members.json";

// The council roster (src/data/council-members.json): students, teacher advisors and school executives of one
// academic year, with their card poster and avatar in public/images/council. The council has no vice-head role.

export type CouncilGroup = "member" | "advisor" | "executive";

export type CouncilMember = {
  id: string;
  /** display order inside a group (and of the departments, by their first member) */
  order: number;
  group: CouncilGroup;
  name: string;
  nickname?: string;
  /** students only */
  department?: string;
  role: string;
  party?: string;
  /** handle without "@" */
  instagram?: string;
  instagramUrl?: string;
  /** full introduction card, 720×938 */
  card: string;
  /** square avatar, 400×400 */
  avatar: string;
};

const GROUPS: readonly CouncilGroup[] = ["member", "advisor", "executive"];
const IG = /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?$/;
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

/** Checks each entry once at build time: unknown groups throw, empty text becomes absent, only Instagram links pass. */
function parse(raw: readonly Record<string, unknown>[]): CouncilMember[] {
  return raw
    .map((r) => {
      const group = r.group as CouncilGroup;
      if (!GROUPS.includes(group)) throw new Error(`council-members.json: unknown group "${String(r.group)}" (${String(r.id)})`);
      const instagramUrl = text(r.instagramUrl);
      const ok = instagramUrl && IG.test(instagramUrl);
      return {
        id: String(r.id), order: Number(r.order), group, name: String(r.name), role: String(r.role),
        nickname: text(r.nickname), department: text(r.department), party: text(r.party),
        instagram: ok ? text(r.instagram)?.replace(/^@/, "") : undefined, instagramUrl: ok ? instagramUrl : undefined,
        card: String(r.card), avatar: String(r.avatar),
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** Academic year (Buddhist era) the roster belongs to. */
export const COUNCIL_YEAR: number = data.year;
export const COUNCIL_MEMBERS: CouncilMember[] = parse(data.members);
