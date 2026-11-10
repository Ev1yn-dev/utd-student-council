"use server";

import { ENTITIES, ENTITY_KEYS } from "@/lib/admin/entities";
import { authorizePermission, getSession } from "@/lib/auth";
import { getYears } from "@/lib/content";
import { adminClient } from "@/lib/supabase/admin";

// Top bar of the back office: the remembered academic year and the content search.

/** Stores the academic year picked in the top bar for this account (admin_users.pref_year). */
export async function setAdminYear(year: number): Promise<{ ok: boolean }> {
  const s = await getSession();
  if (!s?.role || !Number.isInteger(year)) return { ok: false };
  const { years } = await getYears();
  if (!years.includes(year)) return { ok: false };
  const { error } = await adminClient().from("admin_users").update({ pref_year: year }).eq("email", s.email);
  return { ok: !error };
}

export type SearchHit = { entity: string; id: string; title: string };

/** Content titles of one year matching `q` (content.edit only; at most 5 per type). Never message text or names of senders. */
export async function searchContent(q: string, year: number): Promise<SearchHit[]> {
  if (!(await authorizePermission("content.edit")) || !Number.isInteger(year)) return [];
  const term = String(q ?? "").trim().slice(0, 60).replace(/[%,()*:"'\\_]/g, " ").trim();
  if (term.length < 2) return [];
  const db = adminClient();
  const res = await Promise.all(
    ENTITY_KEYS.map(async (k) => {
      const col = ENTITIES[k].titleCol;
      const { data } = await db.from(k).select(`id,${col}`).eq("year", year).ilike(col, `%${term}%`).limit(5);
      return ((data ?? []) as unknown as Record<string, string>[]).map((r) => ({ entity: k, id: r.id, title: r[col] }));
    }),
  );
  return res.flat();
}
