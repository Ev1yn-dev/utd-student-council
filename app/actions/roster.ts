"use server";

import { audit, authorizePermission } from "@/lib/auth";
import { importRoster, parseRosterCsv } from "@/lib/roster";

// error is a message key under roster.errors; values fill its placeholders
export type RosterState = { ok: boolean; error?: string; values?: Record<string, string>; done?: { n: number; off: number } };

const MAX_BYTES = 900 * 1024; // under the 1 MB Server Action body limit
const lines = (xs: number[]) => xs.slice(0, 10).join(", ") + (xs.length > 10 ? ", …" : "");

/** roster.import only: replaces the student roster from an uploaded CSV. Only counts are returned, never IDs. */
export async function importRosterAction(_prev: RosterState, fd: FormData): Promise<RosterState> {
  const s = await authorizePermission("roster.import");
  if (!s) return { ok: false, error: "forbidden" };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "noFile" };
  if (file.size > MAX_BYTES) return { ok: false, error: "tooBig" };
  const year = Number(fd.get("year"));
  if (!Number.isInteger(year) || year < 2560 || year > 2700) return { ok: false, error: "year" };

  const { rows, bad, dupes } = parseRosterCsv(await file.text());
  if (bad.length) return { ok: false, error: "bad", values: { lines: lines(bad) } };
  if (dupes.length) return { ok: false, error: "dupes", values: { lines: lines(dupes) } };
  if (!rows.length) return { ok: false, error: "empty" };
  try {
    const r = await importRoster(rows, year);
    await audit(s, "roster.import", `student_roster:${year}`, { rows: rows.length, deactivated: r.deactivated });
    return { ok: true, done: { n: r.upserted, off: r.deactivated } };
  } catch (e) {
    console.error("[roster]", (e as Error).message);
    return { ok: false, error: "failed" };
  }
}
