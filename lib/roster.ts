import "server-only";
import { adminClient } from "@/lib/supabase/admin";

// Student roster (migration 0015): the voice form only accepts an active student ID from it, and takes the grade from
// it. Service role only. Nothing here returns a list of IDs.

export const STUDENT_ID = /^[0-9]{5}$/;
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

/** Grade (1–6) of an active student, or null when the ID is unknown or inactive. */
export async function studentGrade(studentId: string): Promise<number | null> {
  if (!STUDENT_ID.test(studentId) || !usingSupabase()) return null;
  const { data, error } = await adminClient().from("student_roster").select("grade").eq("student_id", studentId).eq("active", true).maybeSingle();
  if (error) throw new Error(`roster lookup failed: ${error.message}`);
  return data ? Number(data.grade) : null;
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
  const { data } = await db.from("student_roster").select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return { grades, total: grades.reduce((a, g) => a + g.n, 0), updatedAt: (data?.updated_at as string | undefined) ?? null };
}

export type RosterRow = { student_id: string; grade: number; active: boolean };

/**
 * Parses a roster CSV: student_id, grade[, active]. A header row is skipped. The grade may be written 4, ม.4, ม4,
 * M.4 or with a room (ม.4/2). Separators: comma, semicolon or tab. Returns the rows or the bad line numbers.
 */
export function parseRosterCsv(text: string): { rows: RosterRow[]; bad: number[]; dupes: number[] } {
  const rows: RosterRow[] = [];
  const bad: number[] = [];
  const dupes: number[] = [];
  const seen = new Set<string>();
  text.replace(/^﻿/, "").split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, "").trim());
    const id = cells[0] ?? "";
    if (i === 0 && !/^[0-9]/.test(id)) return; // header
    const grade = Number((cells[1] ?? "").replace(/^(ม\.?|m\.?)\s*/i, "").match(/^[1-6]/)?.[0]);
    const act = (cells[2] ?? "").toLowerCase();
    if (!STUDENT_ID.test(id) || !grade) {
      bad.push(i + 1);
      return;
    }
    if (seen.has(id)) {
      dupes.push(i + 1);
      return;
    }
    seen.add(id);
    rows.push({ student_id: id, grade, active: !["0", "false", "no", "n", "ไม่", "inactive", "ลาออก", "จบ"].includes(act) });
  });
  return { rows, bad, dupes };
}

/** Replaces the roster: upserts every row, marks students missing from the file inactive. */
export async function importRoster(rows: RosterRow[]) {
  const { data, error } = await adminClient().rpc("roster_import", { p_rows: rows });
  if (error) throw new Error(`roster import failed: ${error.message}`);
  openCache = null;
  const r = (Array.isArray(data) ? data[0] : data) as { upserted: number; deactivated: number } | null;
  return { upserted: Number(r?.upserted ?? rows.length), deactivated: Number(r?.deactivated ?? 0) };
}
