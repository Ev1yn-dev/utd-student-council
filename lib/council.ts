// Council structure for the back office (members table): fixed role set and departments.
// Plain TypeScript (no path aliases, no JSON import) so Node can also run it directly (scripts/seed-2569.mjs, tests).

// The council has no vice head (deputy head of a department).
export const COUNCIL_ROLES = ["president", "vice_president", "head", "member"] as const;
export type CouncilRole = (typeof COUNCIL_ROLES)[number];

export const isCouncilRole = (v: unknown): v is CouncilRole => typeof v === "string" && (COUNCIL_ROLES as readonly string[]).includes(v);

/**
 * Role from a Thai position title, by its first word: "รองประธาน…" -> vice_president, "ประธาน…" -> president,
 * "หัวหน้าฝ่าย…" -> head, anything else -> member.
 * "รองประธาน" is checked first because "ประธาน" also appears inside it.
 */
export function roleFromTitle(title: string): CouncilRole {
  const t = title.normalize("NFC").replace(/\s+/g, "").trim();
  if (t.startsWith("รองประธาน")) return "vice_president";
  if (t.startsWith("ประธาน")) return "president";
  if (t.startsWith("หัวหน้า")) return "head";
  return "member";
}

export type Department = { key: string; th: string; en: string };
