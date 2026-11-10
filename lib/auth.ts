import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { permissionsOf, type AdminRole, type Permission } from "@/lib/admin/permissions";
import { decideAccess, googleVerified, normalizeEmail, supabaseConfigured, type Access, type AdminRow } from "@/lib/env";
import { clientIp, hashIp } from "@/lib/security";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export { googleVerified };

/** Signed-in person. `role` null = signed in on the school domain without back-office access (/pending-access). */
export type Session = { id: string; email: string; role: AdminRole | null; perms: Permission[]; extra: string[]; prefYear: number | null };
export type AdminSession = Session & { role: AdminRole };

type Row = { role: string; disabled: boolean; extra_permissions: string[] | null; pref_year: number | null };

/** The address's row in admin_users (service role: the table is not readable by any token). */
async function adminRow(email: string): Promise<Row | null> {
  const { data } = await adminClient().from("admin_users").select("role,disabled,extra_permissions,pref_year").eq("email", email).maybeSingle();
  return (data as Row | null) ?? null;
}

/** profiles.role is what RLS (public.is_staff / is_member) reads; kept in step with the back-office role. */
const profileRole = (a: Access) => (a === "owner" || a === "admin" ? "admin" : a === "editor" ? "teacher" : null);

/**
 * Sign-in rule + role for a verified Google address (lib/env.ts decideAccess: admin_users row -> ADMIN_EMAILS bootstrap
 * -> school domain = pending -> denied), re-evaluated on every request so a change on the users page takes effect at once.
 * An ADMIN_EMAILS address without a row gets an owner row here, so it can be managed on the users page afterwards.
 */
export async function resolveAccess(id: string, email: string, verified: boolean): Promise<{ access: Access; row: Row | null }> {
  const e = normalizeEmail(email);
  let row = await adminRow(e);
  const access = decideAccess(e, verified, row ? { role: row.role, disabled: row.disabled } satisfies AdminRow : null);
  const db = adminClient();
  if (access === "owner" && !row) {
    const { error } = await db.from("admin_users").insert({ email: e, role: "owner", created_by: "ADMIN_EMAILS" });
    if (error && error.code !== "23505") console.error("[auth] owner bootstrap failed", error.message);
    else void audit({ email: e }, "user.bootstrap", e, { role: "owner" });
    row = { role: "owner", disabled: false, extra_permissions: [], pref_year: null };
  }
  const want = profileRole(access);
  const { data } = await db.from("profiles").select("role").eq("id", id).maybeSingle();
  if ((data?.role ?? null) !== want) {
    const { error } = await db.from("profiles").upsert({ id, email: e, role: want });
    if (error) console.error("[auth] role sync failed", error.message);
  }
  return { access, row };
}

/**
 * Verified session (token validated by the Auth server) + sign-in rule re-check + role and permissions.
 * null = not logged in / not allowed. Cached for one request (layout, page and actions share one lookup).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!supabaseConfigured()) return null;
  const { data } = await (await createClient()).auth.getUser();
  const u = data.user;
  const email = normalizeEmail(u?.email);
  if (!u || !email) return null;
  const { access, row } = await resolveAccess(u.id, email, googleVerified(u));
  if (access === "denied") return null;
  if (access === "pending") return { id: u.id, email, role: null, perms: [], extra: [], prefYear: null };
  const extra = row?.extra_permissions ?? [];
  return { id: u.id, email, role: access, perms: [...permissionsOf({ role: access, extra, disabled: false })], extra, prefYear: row?.pref_year ?? null };
});

export const hasPermission = (s: Pick<Session, "perms"> | null, p: Permission) => !!s?.perms.includes(p);

/**
 * The one server-side gate for pages and layouts: signed in, a back-office role, and permission `perm`.
 * Without a session -> sign-in page; signed in without a role -> /pending-access; without the permission -> the
 * overview with a notice (or, for the overview's own permission, /pending-access, so it can never loop).
 * Several permissions = any one of them (a page with sections for each).
 * The menu hides what a person may not use, but this check is what actually protects a page.
 */
export async function requirePermission(...anyOf: [Permission, ...Permission[]]): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.role) redirect("/pending-access");
  if (!anyOf.some((p) => s.perms.includes(p))) redirect(anyOf.includes("stats.view") ? "/pending-access" : "/admin?denied=1");
  return s as AdminSession;
}

/** Same rule for Server Actions and route handlers: returns null instead of redirecting (they answer "forbidden"). */
export async function authorizePermission(perm: Permission): Promise<AdminSession | null> {
  const s = await getSession();
  return s?.role && s.perms.includes(perm) ? (s as AdminSession) : null;
}

/** Any back-office role (the shell itself; every page inside still calls requirePermission). */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.role) redirect("/pending-access");
  return s as AdminSession;
}

/** Called from the OAuth callback: create/refresh the profile and stamp the login (the role comes from resolveAccess). */
export async function syncProfile(userId: string, email: string) {
  const db = adminClient();
  const { data } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
  const stamp = { email: normalizeEmail(email), last_login_at: new Date().toISOString() };
  const { error } = data ? await db.from("profiles").update(stamp).eq("id", userId) : await db.from("profiles").insert({ id: userId, role: null, ...stamp });
  if (error) console.error("[auth] profile sync failed", error.message);
}

/** Who did it, from where: hashed IP + user agent (shared accounts like the council's address are used by several people). */
async function requestMeta(): Promise<{ ip_hash: string | null; ua?: string }> {
  try {
    const h = await headers();
    const ip = clientIp(h);
    return { ip_hash: ip !== "unknown" ? hashIp(ip) : null, ua: (h.get("user-agent") ?? "").slice(0, 200) };
  } catch {
    return { ip_hash: null }; // outside a request
  }
}

/**
 * One entry in admin_audit (kept 1 year; shown on the security page). Actions are dotted names, e.g. "auth.login",
 * "user.role", "content.publish", "message.identity", "data.export". Never pass message text or student names.
 */
export async function audit(actor: Pick<Session, "email">, action: string, target?: string, details: Record<string, unknown> = {}) {
  const { ip_hash, ua } = await requestMeta();
  const { error } = await adminClient().from("admin_audit").insert({
    actor_email: actor.email,
    action,
    target: target ?? null,
    details: ua ? { ...details, ua } : details,
    ip_hash,
  });
  if (error) console.error("[audit] insert failed", error.message);
}
