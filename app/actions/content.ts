"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { ENTITIES, isEntity, rowColumns, type EntityKey } from "@/lib/admin/entities";
import { parse, type Err } from "@/lib/admin/validate";
import { checkIncoming, makeVariants, publishPhotos, removePhotoFiles, signedUpload } from "@/lib/admin/photos";
import { applyConsent, applyIgConsent } from "@/lib/admin/consent";
import type { Permission } from "@/lib/admin/permissions";
import { audit, authorizePermission } from "@/lib/auth";
import { limit } from "@/lib/ratelimit";
import { ipAllowlisted } from "@/lib/rl-bypass";
import { clientIp } from "@/lib/security";
import { logSecurity } from "@/lib/security-log";
import { adminClient } from "@/lib/supabase/admin";

// Back-office content actions. Every action first checks the caller's permission on the server (authorizePermission:
// content.edit, years.manage, banners.edit, consent.view - never the UI), then writes with the service role.
// New rows start as 'pending' (a draft) and reach the site when someone with content.edit publishes them.
// Errors are message keys under dashboard.errors (the client translates them).

export type Result = { ok: true } | { ok: false; error: Err };
export type FormState = { ok: boolean; id?: string; error?: Err; fieldErrors?: Record<string, Err> };

const fail = (key: string, values?: Record<string, number>) => ({ ok: false as const, error: { key, values } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const role = authorizePermission;
/** The first of several permissions the caller has (photo uploads serve both content and banners). */
async function roleAny(...perms: Permission[]) {
  for (const p of perms) {
    const s = await role(p);
    if (s) return s;
  }
  return null;
}
const revalidateAdmin = () => revalidatePath("/[locale]/admin", "layout");
/** Logged, then answered with the translated "forbidden". */
const denied = () => {
  after(() => logSecurity("forbidden", { detail: { at: "admin content action" } }));
  return fail("forbidden");
};

export async function saveEntity(key: EntityKey, id: string | null, year: number, locale: string, _prev: FormState, fd: FormData): Promise<FormState> {
  if (!isEntity(key) || (id !== null && !UUID.test(id)) || !Number.isInteger(year)) return fail("badRequest");
  const s = await role("content.edit");
  if (!s) return denied();
  const e = ENTITIES[key];
  const { values, images, errors } = parse(e, fd);
  if (Object.keys(errors).length) return { ok: false, error: { key: "fix" }, fieldErrors: errors };

  const db = adminClient();

  const cols = Object.fromEntries(rowColumns(e).map((c) => [c, values[c]]));
  const res = id
    ? await db.from(key).update(cols).eq("id", id).select("id").maybeSingle()
    : await db.from(key).insert({ ...cols, year, author_id: s.id, status: "pending" }).select("id").single();
  if (res.error || !res.data) {
    if (res.error?.code === "23505") return { ok: false, error: { key: "slugTaken" }, fieldErrors: { slug: { key: "slugTaken" } } };
    console.error("[dashboard] save", key, res.error?.message);
    return fail(id ? "editLocked" : "saveFailed");
  }
  const rowId = res.data.id as string;

  // link gallery photos (all updates in parallel)
  const admin = db;
  await Promise.all(e.fields.flatMap((f) => {
    if (f.kind !== "images") return [];
    const ids = images[f.name];
    let unlink = admin.from("photos").update({ [f.fk]: null }).eq(f.fk, rowId);
    if (ids.length) unlink = unlink.not("id", "in", `(${ids.join(",")})`);
    return [unlink, ...ids.map((pid, i) => admin.from("photos").update({ [f.fk]: rowId, sort_order: i }).eq("id", pid))];
  }));

  after(() => audit(s, id ? "content.update" : "content.create", `${key}:${rowId}`));
  revalidatePath(`/${locale}/admin/content/${key}`);
  // navigation (back to the list, or a new blank form) is done by the client so the list can update optimistically
  return { ok: true, id: rowId };
}

export async function deleteEntity(key: EntityKey, id: string): Promise<Result> {
  if (!isEntity(key) || !UUID.test(id)) return fail("badRequest");
  const s = await role("content.edit");
  if (!s) return denied();
  // photos that belong only to this row (gallery rows cascade in the DB, but their files would stay in storage)
  const admin = adminClient();
  const e = ENTITIES[key];
  const imageCols = e.fields.filter((f) => f.kind === "image").map((f) => f.name);
  const fks = e.fields.flatMap((f) => (f.kind === "images" ? [f.fk] : []));
  const { data: row } = imageCols.length ? await admin.from(key).select(imageCols.join(",")).eq("id", id).maybeSingle() : { data: null };
  const single = imageCols.map((c) => (row as unknown as Record<string, string | null> | null)?.[c]).filter((x): x is string => !!x);
  const linked = (await Promise.all(fks.map((fk) => admin.from("photos").select("id").eq(fk, id)))).flatMap((r) => (r.data ?? []).map((p) => p.id as string));
  const photoIds = [...single, ...linked];
  const { data: photos } = photoIds.length ? await admin.from("photos").select("id,uploaded_by,static_path").in("id", photoIds) : { data: [] };

  const { error, count } = await admin.from(key).delete({ count: "exact" }).eq("id", id);
  if (error || !count) return fail("deleteFailed");
  const own = (photos ?? []).filter((p) => !p.static_path);
  if (own.length) {
    await admin.from("photos").delete().in("id", own.map((p) => p.id));
    after(() => Promise.all(own.map((p) => removePhotoFiles(p.id, p.uploaded_by))).catch((err) => console.error("[dashboard] remove files", err)));
  }
  after(() => audit(s, "content.delete", `${key}:${id}`));
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Publish (also publishes the row's photos), reject (with reason) or hide. */
export async function reviewEntity(key: EntityKey, id: string, action: "approve" | "reject" | "hide", reason: string): Promise<Result> {
  if (!isEntity(key) || !UUID.test(id) || !["approve", "reject", "hide"].includes(action)) return fail("badRequest");
  const s = await role("content.edit");
  if (!s) return denied();
  const r = String(reason ?? "").trim().slice(0, 500);
  if (action === "reject" && !r) return fail("reasonRequired");
  const e = ENTITIES[key];
  const db = adminClient();

  try {
    if (action === "approve") {
      const imageCols = e.fields.filter((f) => f.kind === "image").map((f) => f.name);
      const { data: row } = await db.from(key).select(["id", ...imageCols].join(",")).eq("id", id).single();
      const ids = imageCols.map((c) => (row as unknown as Record<string, string | null>)?.[c]).filter((x): x is string => !!x);
      for (const f of e.fields) {
        if (f.kind !== "images") continue;
        const { data } = await db.from("photos").select("id").eq(f.fk, id);
        ids.push(...(data ?? []).map((p) => p.id as string));
      }
      await publishPhotos(ids, s.id);
    }
    const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "hidden";
    const { error } = await db.from(key).update({ status, reviewed_by: s.id, reviewed_at: new Date().toISOString(), reason: action === "reject" ? r : null }).eq("id", id);
    if (error) throw error;
  } catch (err) {
    console.error("[dashboard] review", key, id, err);
    return fail("reviewFailed");
  }
  after(() => audit(s, action === "approve" ? "content.publish" : action === "reject" ? "content.reject" : "content.hide", `${key}:${id}`, r ? { reason: r } : {}));
  // the public pages and the back office show the new state on the next request
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

// ───────────────────────── photos ─────────────────────────

/** One-time URL for the browser to PUT an already-compressed WebP straight into storage (not through Next). */
export async function createUploadUrl(): Promise<Result & { id?: string; url?: string }> {
  const s = await roleAny("content.edit", "banners.edit");
  if (!s) return denied();
  // 60 photos / 10 min per user; not for owners / admins or RATE_LIMIT_ALLOW_IPS
  const exempt = s.role === "owner" || s.role === "admin" || ipAllowlisted(clientIp(await headers()));
  const rl = exempt ? { ok: true, retryAfter: 0 } : await limit("upload", s.id);
  if (!rl.ok) return fail("rate", { min: Math.ceil(rl.retryAfter / 60) });
  try {
    return { ok: true, ...(await signedUpload(s.id)) };
  } catch (err) {
    console.error("[dashboard] upload url", err);
    return fail("upload");
  }
}

/** Registers an upload as a pending photo right away; variants are built in the background (after the response). */
export async function finalizeUpload(id: string, width: number, height: number): Promise<Result & { id?: string }> {
  const s = await roleAny("content.edit", "banners.edit");
  if (!s) return denied();
  if (!UUID.test(String(id)) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 60_000_000) {
    return fail("badRequest");
  }
  try {
    const file = await checkIncoming(s.id, id);
    if (file === "missing") return fail("upload");
    if (file === "bad") {
      after(() => logSecurity("upload_rejected", { userId: s.id, detail: { id } }));
      return fail("badFile");
    }
    const { error } = await adminClient()
      .from("photos")
      .insert({ id, width: Math.min(width, 1920), height: Math.round(height * Math.min(1, 1920 / width)), caption: "", status: "pending", uploaded_by: s.id });
    if (error) throw error;
    after(() => makeVariants(id, s.id).catch((err) => console.error("[dashboard] variants", id, err)));
    return { ok: true, id };
  } catch (err) {
    console.error("[dashboard] upload", err);
    return fail("upload");
  }
}

// ───────────────────────── academic years (years.manage) ─────────────────────────

export async function addYear(_prev: FormState, fd: FormData): Promise<FormState> {
  const s = await role("years.manage");
  if (!s) return denied();
  const year = Number(fd.get("year"));
  const copyFrom = Number(fd.get("copyFrom")) || null;
  if (!Number.isInteger(year) || year < 2500 || year > 2700) return { ok: false, fieldErrors: { year: { key: "yearInvalid" } } };
  const db = adminClient();
  const { error } = await db.from("academic_years").insert({ year, is_current: false });
  if (error) return fail(error.code === "23505" ? "yearExists" : "yearFailed");

  if (copyFrom) {
    // copy the structure only: positions/order of council members (names left as placeholders) and the advisor list.
    // Copies start as 'pending' so nothing reaches the site before review.
    const [{ data: members }, { data: advisors }] = await Promise.all([
      db.from("members").select("role_title,role_title_en,term_no,exec_title,exec_title_en,dept,dept_en,sort_order").eq("year", copyFrom).neq("status", "hidden"),
      db.from("advisors").select("name,name_en,nickname,nickname_en,role_label,role_label_en,subject_group,subject_group_en,position,position_en,sort_order,photo_id").eq("year", copyFrom).neq("status", "hidden"),
    ]);
    const base = { year, status: "pending", author_id: s.id };
    if (members?.length) await db.from("members").insert(members.map((m) => ({ ...m, ...base, name: "[ชื่อ-สกุล]" })));
    if (advisors?.length) await db.from("advisors").insert(advisors.map((a) => ({ ...a, ...base })));
  }
  await audit(s, "year.add", String(year), copyFrom ? { copyFrom } : {});
  revalidateAdmin();
  return { ok: true };
}

export async function setCurrentYear(year: number): Promise<Result> {
  const s = await role("years.manage");
  if (!s) return denied();
  if (!Number.isInteger(year)) return fail("badRequest");
  const db = adminClient();
  const { data } = await db.from("academic_years").select("year").eq("year", year).maybeSingle();
  if (!data) return fail("badRequest");
  await db.from("academic_years").update({ is_current: false }).eq("is_current", true);
  await db.from("academic_years").update({ is_current: true }).eq("year", year);
  await audit(s, "year.current", String(year));
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

// ───────────────────────── banners / hero slides (banners.edit) ─────────────────────────

/** Deletes a photo row (any photo, incl. banner files shipped in public/banner — the file itself stays) and its storage variants. */
export async function deletePhoto(photoId: string): Promise<Result> {
  if (!UUID.test(photoId)) return fail("badRequest");
  const s = await role("banners.edit");
  if (!s) return denied();
  const db = adminClient();
  const { data: p } = await db.from("photos").select("static_path,uploaded_by").eq("id", photoId).maybeSingle();
  if (!p) return fail("badRequest");
  const { error } = await db.from("photos").delete().eq("id", photoId);
  if (error) return fail("deleteFailed");
  if (!p.static_path) await removePhotoFiles(photoId, p.uploaded_by);
  await audit(s, "banner.delete", `photos:${photoId}`);
  revalidateAdmin();
  return { ok: true };
}

/** Show in the hero or not, order, and an optional show window (dates inclusive, "" = no limit). */
export async function setHero(photoId: string, on: boolean, order: number, start = "", end = ""): Promise<Result> {
  const date = (d: string) => d === "" || (/^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)));
  if (!UUID.test(photoId) || !Number.isInteger(order) || order < 0 || order > 999 || !date(start) || !date(end)) return fail("badRequest");
  if (start && end && start > end) return fail("heroWindow");
  const s = await role("banners.edit");
  if (!s) return denied();
  const { error } = await adminClient().from("photos")
    .update({ is_hero: on, hero_order: order, hero_start: start || null, hero_end: end || null }).eq("id", photoId).eq("status", "approved");
  if (error) return fail("saveFailed");
  await audit(s, on ? "banner.show" : "banner.hide", `photos:${photoId}`, { order, start, end });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

// ───────────────────────── member photo / IG consent (consent.view) ─────────────────────────

/** One member: true = show photo, false = refused, null = not asked yet. Files follow at once (lib/admin/consent.ts). */
export async function setPhotoConsent(memberId: string, value: boolean | null): Promise<Result> {
  if (!UUID.test(memberId) || ![true, false, null].includes(value)) return fail("badRequest");
  const s = await role("consent.view");
  if (!s) return denied();
  try {
    await applyConsent([memberId], value);
  } catch (err) {
    console.error("[dashboard] consent", err);
    return fail("saveFailed");
  }
  after(() => audit(s, "consent.photo", `members:${memberId}`, { value }));
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Every member of a year at once. The page asks twice; the server also needs the exact count the admin confirmed. */
export async function setPhotoConsentAll(year: number, confirmedCount: number): Promise<Result & { n?: number }> {
  if (!Number.isInteger(year) || !Number.isInteger(confirmedCount)) return fail("badRequest");
  const s = await role("consent.view");
  if (!s) return denied();
  const { data } = await adminClient().from("members").select("id").eq("year", year).neq("status", "hidden");
  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length || ids.length !== confirmedCount) return fail("badRequest");
  try {
    await applyConsent(ids, true);
  } catch (err) {
    console.error("[dashboard] consent all", err);
    return fail("saveFailed");
  }
  after(() => audit(s, "consent.photo.all", `members:${year}`, { n: ids.length }));
  revalidatePath("/[locale]", "layout");
  return { ok: true, n: ids.length };
}

/** One member's Instagram / contact on the site (consent_public). */
export async function setIgConsent(memberId: string, on: boolean): Promise<Result> {
  if (!UUID.test(memberId) || typeof on !== "boolean") return fail("badRequest");
  const s = await role("consent.view");
  if (!s) return denied();
  try {
    await applyIgConsent([memberId], on);
  } catch (err) {
    console.error("[dashboard] ig consent", err);
    return fail("saveFailed");
  }
  after(() => audit(s, "consent.ig", `members:${memberId}`, { on }));
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Every member of a year with an Instagram handle. Asked twice on the page; the server checks the confirmed count. */
export async function setIgConsentAll(year: number, confirmedCount: number): Promise<Result & { n?: number }> {
  if (!Number.isInteger(year) || !Number.isInteger(confirmedCount)) return fail("badRequest");
  const s = await role("consent.view");
  if (!s) return denied();
  const { data } = await adminClient().from("members").select("id").eq("year", year).neq("status", "hidden").neq("instagram", "");
  const ids = (data ?? []).map((r) => r.id as string);
  if (!ids.length || ids.length !== confirmedCount) return fail("badRequest");
  try {
    await applyIgConsent(ids, true);
  } catch (err) {
    console.error("[dashboard] ig consent all", err);
    return fail("saveFailed");
  }
  after(() => audit(s, "consent.ig.all", `members:${year}`, { n: ids.length }));
  revalidatePath("/[locale]", "layout");
  return { ok: true, n: ids.length };
}
