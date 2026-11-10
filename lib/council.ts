// Council structure: fixed role set, role order, and grouping members into departments.
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

export const roleRank = (r: CouncilRole) => COUNCIL_ROLES.indexOf(r);

export type Department = { key: string; th: string; en: string };

/** One department section: its people in role order (then stored order). */
export type DeptSection<P> = { dept: Department; people: P[] };

/**
 * Groups people by department in the departments' order. People whose department is unknown end up in a last
 * section with key "other". Within a section: president -> vice_president -> head -> member, ties keep their
 * stored order (`rank`).
 */
export function groupByDepartment<P extends { deptKey: string | null; councilRole: CouncilRole; rank: number }>(
  people: P[],
  departments: Department[],
  other: Department,
): DeptSection<P>[] {
  const known = new Set(departments.map((d) => d.key));
  const sorted = [...people].sort((a, b) => roleRank(a.councilRole) - roleRank(b.councilRole) || a.rank - b.rank);
  const sections = [...departments, other].map((dept) => {
    const list = sorted.filter((p) => (dept === other ? !p.deptKey || !known.has(p.deptKey) : p.deptKey === dept.key));
    return { dept, people: list };
  });
  return sections.filter((s) => s.people.length > 0);
}
