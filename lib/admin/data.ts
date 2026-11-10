import "server-only";
import { ENTITIES, type EntityKey, type ReviewStatus } from "@/lib/admin/entities";
import { previewUrls } from "@/lib/admin/photos";
import { getYears } from "@/lib/content";
import { adminClient } from "@/lib/supabase/admin";
import { publicImageUrl } from "@/lib/supabase/public";

// Back-office reads (service role). Callers have already passed requirePermission("content.edit" / "stats.view" / ...).

export type ListRow = {
  id: string; title: string; titleEn: string | null; sub: string; status: ReviewStatus; reason: string | null; mine: boolean;
};

/**
 * The academic year a back-office page works on: ?year= when valid, else the year this person last picked in the top
 * bar (admin_users.pref_year), else the current year.
 */
export async function yearParam(raw: string | undefined, pref?: number | null) {
  const { years, current } = await getYears();
  const y = Number(raw);
  return { years, current, year: years.includes(y) ? y : pref && years.includes(pref) ? pref : current };
}

export const PAGE_SIZE = 20;

/** One page of a back-office list, optionally filtered by a search over the Thai/English title and subtitle. */
export async function listRows(key: EntityKey, year: number, userId: string, opts: { page?: number; q?: string } = {}): Promise<{ rows: ListRow[]; total: number; page: number; pages: number }> {
  const e = ENTITIES[key];
  const hasEn = e.fields.some((f) => f.name === e.titleCol && "en" in f && f.en);
  const cols = ["id", e.titleCol, hasEn && `${e.titleCol}_en`, e.subCol, "status", "reason", "author_id"].filter(Boolean).join(",");
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  let q = adminClient().from(key).select(cols, { count: "exact" }).eq("year", year);
  const term = (opts.q ?? "").trim().slice(0, 80).replace(/[%,()*]/g, " ");
  // text columns only (the subtitle can be a date column, which ilike would reject)
  if (term) q = q.or([e.titleCol, hasEn && `${e.titleCol}_en`].filter(Boolean).map((c) => `${c}.ilike.*${term}*`).join(","));
  const { data, error, count } = await q
    .order(e.order.col, { ascending: e.order.asc })
    .order("id")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) console.error("[admin] list", key, error.message);
  const total = count ?? 0;
  const rows = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: String(r[e.titleCol] ?? ""),
    titleEn: hasEn ? String(r[`${e.titleCol}_en`] ?? "") || null : null,
    sub: e.subCol ? String(r[e.subCol] ?? "") : "",
    status: r.status as ReviewStatus,
    reason: (r.reason as string | null) ?? null,
    mine: r.author_id === userId,
  }));
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** Total and pending rows per entity for the overview. */
export async function counts(year: number) {
  const db = adminClient();
  const out = {} as Record<EntityKey, { total: number; published: number; pending: number }>;
  await Promise.all(
    (Object.keys(ENTITIES) as EntityKey[]).map(async (k) => {
      const { data } = await db.from(k).select("status").eq("year", year);
      const rows = (data ?? []) as { status: string }[];
      out[k] = { total: rows.length, published: rows.filter((r) => r.status === "approved").length, pending: rows.filter((r) => r.status === "pending").length };
    }),
  );
  return out;
}

export type FormPhoto = { id: string; url: string; pending: boolean };

/** A row for the edit form plus preview URLs of its photos (single image columns and linked galleries). */
export async function getRowForForm(key: EntityKey, id: string) {
  const e = ENTITIES[key];
  const db = adminClient();
  const { data: row } = await db.from(key).select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const r = row as Record<string, unknown>;
  const single = e.fields.filter((f) => f.kind === "image").map((f) => r[f.name] as string | null).filter((x): x is string => !!x);
  const galleries: Record<string, string[]> = {};
  const ids = [...single];
  for (const f of e.fields) {
    if (f.kind !== "images") continue;
    const { data } = await db.from("photos").select("id").eq(f.fk, id).order("sort_order");
    galleries[f.name] = (data ?? []).map((p) => p.id as string);
    ids.push(...galleries[f.name]);
  }
  const { data: photos } = ids.length ? await db.from("photos").select("id,status,uploaded_by").in("id", ids) : { data: [] };
  const status = new Map((photos ?? []).map((p) => [p.id as string, p.status as string]));
  const urls = await previewUrls((photos ?? []).map((p) => ({ id: p.id as string, status: p.status as string, uploadedBy: p.uploaded_by as string | null })));
  const photo = (pid: string): FormPhoto | null => (urls[pid] ? { id: pid, url: urls[pid], pending: status.get(pid) !== "approved" } : null);
  const media: Record<string, FormPhoto[]> = {};
  for (const f of e.fields) {
    if (f.kind === "image") media[f.name] = [r[f.name] as string | null].filter((x): x is string => !!x).map(photo).filter((x): x is FormPhoto => !!x);
    if (f.kind === "images") media[f.name] = galleries[f.name].map(photo).filter((x): x is FormPhoto => !!x);
  }
  return { row: r, media };
}

export async function approvedPhotos() {
  const { data } = await adminClient()
    .from("photos").select("id,caption,alt_th,is_hero,hero_order,hero_start,hero_end,created_at,static_path,credit").eq("status", "approved").order("is_hero", { ascending: false }).order("hero_order").order("created_at", { ascending: false }).limit(200);
  return (data ?? []).map((p) => ({
    id: p.id as string, caption: (p.alt_th as string | null) || (p.caption as string), isHero: !!p.is_hero, order: p.hero_order as number,
    start: (p.hero_start as string | null) ?? "", end: (p.hero_end as string | null) ?? "",
    credit: p.credit === "school" || p.credit === "council" ? (p.credit as "school" | "council") : null,
    // shipped files: /banner/<name>-768.webp (school) or /banners/<name>-640.webp (council banners)
    url: p.static_path ? `${p.static_path}-${(p.static_path as string).startsWith("/banners/") ? 640 : 768}.webp` : publicImageUrl(`photos/${p.id}/480.webp`),
  }));
}
