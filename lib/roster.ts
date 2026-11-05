import "server-only";
import { adminClient } from "@/lib/supabase/admin";

// Student roster (migration 0015): the voice form only accepts an active student ID from it, and takes the grade from
// it. Service role only. Nothing here returns a list of IDs.

import { STUDENT_ID, type RosterRow } from "@/lib/roster-csv";

export { parseRosterCsv, type RosterRow } from "@/lib/roster-csv";
const usingSupabase = () => !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

let openCache: { open: boolean; exp: number } | null = null;

/** True once a roster with at least one active student has been imported (cached for a minute). */
export async function rosterOpen(): Promise<boolean> {
  if (!usingSupabase()) return false;
  if (openCache && openCache.exp > Date.now()) return openCache.open;
  const { count, error } = await adminClient().from("student_roster").select("student_id", { count: "exact", head: true }).eq("active", true);
  if (error) {
    console.error("[roster] count failed", error.message);
    return false;
  }
  openCache = { open: (count ?? 0) > 0, exp: Date.now() + 60_000 };
  return openCache.open;
}

export type Student = { grade: number; room: string | null; prefix: string | null; first_name: string | null; last_name: string | null };

/** An active student's grade, room and name (snapshot for a submission), or null when unknown or inactive. */
export async function studentRecord(studentId: string): Promise<Student | null> {
  if (!STUDENT_ID.test(studentId) || !usingSupabase()) return null;
  const { data, error } = await adminClient()
    .from("student_roster")
    .select("grade,room,prefix,first_name,last_name")
    .eq("student_id", studentId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(`roster lookup failed: ${error.message}`);
  return data ? { grade: Number(data.grade), room: data.room ?? null, prefix: data.prefix ?? null, first_name: data.first_name ?? null, last_name: data.last_name ?? null } : null;
}

/** Thai academic year now (starts in May): 2569 for May 2026 – April 2027. */
export function currentAcademicYear(now = new Date()) {
  return now.getFullYear() + 543 - (now.getMonth() < 4 ? 1 : 0);
}

/** Active students per grade (counts only) and the last import time, for the admin page. */
export async function rosterSummary() {
  const db = adminClient();
  const grades = await Promise.all(
    [1, 2, 3, 4, 5, 6].map(async (g) => {
      const { count, error } = await db.from("student_roster").select("student_id", { count: "exact", head: true }).eq("active", true).eq("grade", g);
      if (error) throw new Error(error.message);
      return { grade: g, n: count ?? 0 };
    }),
  );
  const { data } = await db.from("student_roster").select("updated_at,academic_year").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return {
    grades,
    total: grades.reduce((a, g) => a + g.n, 0),
    updatedAt: (data?.updated_at as string | undefined) ?? null,
    year: (data?.academic_year as number | null | undefined) ?? null,
  };
}

/** Replaces the roster: upserts every row, marks students missing from the file inactive. */
export async function importRoster(rows: RosterRow[], year: number) {
  const { data, error } = await adminClient().rpc("roster_import", { p_rows: rows, p_year: year });
  if (error) throw new Error(`roster import failed: ${error.message}`);
  openCache = null;
  const r = (Array.isArray(data) ? data[0] : data) as { upserted: number; deactivated: number } | null;
  return { upserted: Number(r?.upserted ?? rows.length), deactivated: Number(r?.deactivated ?? 0) };
}
