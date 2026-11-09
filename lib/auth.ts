import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { decideAccess, googleVerified, normalizeEmail, supabaseConfigured, type Access, type AllowedRow } from "@/lib/env";
import { clientIp, hashIp } from "@/lib/security";
import { adminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export { googleVerified };

export type Role = "council" | "teacher" | "admin";
export type Session = { id: string; email: string; role: Role | null };


/** The address's row in allowed_users (service role: the table is not readable by any token). */
async function allowedRow(email: string): Promise<AllowedRow> {
  const { data } = await adminClient().from("allowed_users").select("role,active").eq("email", email).maybeSingle();
  return data ? { role: data.role as string, active: !!data.active } : null;
}

/**
 * Sign-in rule + role for a verified Google address (lib/env.ts decideAccess: ADMIN_EMAILS -> allowed_users ->
 * school domain = pending -> denied), re-evaluated on every request so a change takes effect at once.
 * profiles.role is kept equal to the result, because RLS (public.is_staff / is_member) reads it: removing someone
 * from ADMIN_EMAILS or switching off their allowed_users row also removes their rights against the REST API.
 */
export async function resolveAccess(id: string, email: string, verified: boolean): Promise<Access> {
  const access = decideAccess(email, verified, await allowedRow(normalizeEmail(email)));
  const want = access === "admin" || access === "council" || access === "teacher" ? access : null;
  const db = adminClient();
  const { data } = await db.from("profiles").select("role").eq("id", id).maybeSingle();
  if ((data?.role ?? null) !== want) {
    const { error } = await db.from("profiles").upsert({ id, email: normalizeEmail(email), role: want });
    if (error) console.error("[auth] role sync failed", error.message);
  }
  return access;
}


/** Verified session (token validated by the Auth server) + sign-in rule re-check + role. null = not logged in / not allowed. */
export async function getSession(): Promise<Session | null> {
  if (!supabaseConfigured()) return null;
  const { data } = await (await createClient()).auth.getUser();
  const u = data.user;
  const email = normalizeEmail(u?.email);
  if (!u || !email) return null;
  const access = await resolveAccess(u.id, email, googleVerified(u));
  if (access === "denied") return null;
  return { id: u.id, email, role: access === "pending" ? null : access };
}

/**
 * The one authorization check for Server Actions and route handlers: verified session (Auth server) + sign-in rule +
 * role in `allowed`. Returns null instead of throwing, so actions answer with a translated "forbidden".
 * Pages/layouts use requireRole() below (same rule, but redirects).
 */
export async function authorize(allowed: Role[]): Promise<(Session & { role: Role }) | null> {
  const s = await getSession();
  return s?.role && allowed.includes(s.role) ? (s as Session & { role: Role }) : null;
}

/** For pages/layouts: redirects when the caller lacks access. */
export async function requireRole(allowed: Role[]): Promise<Session & { role: Role }> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.role) redirect("/pending-access");
  if (!allowed.includes(s.role)) redirect("/dashboard?denied=1");
  return s as Session & { role: Role };
}

/** For server actions: throws (never trusts anything sent by the client). */
export async function assertRole(allowed: Role[]): Promise<Session & { role: Role }> {
  const s = await getSession();
  if (!s?.role || !allowed.includes(s.role)) throw new Error("forbidden");
  return s as Session & { role: Role };
}

export const STAFF: Role[] = ["teacher", "admin"];
export const MEMBERS: Role[] = ["council", "teacher", "admin"];

/** Called from the OAuth callback: create/refresh the profile and stamp the login (the role comes from resolveAccess). */
export async function syncProfile(userId: string, email: string) {
  const db = adminClient();
  const { data } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
  const stamp = { email: normalizeEmail(email), last_login_at: new Date().toISOString() };
  const { error } = data ? await db.from("profiles").update(stamp).eq("id", userId) : await db.from("profiles").insert({ id: userId, role: null, ...stamp });
  if (error) console.error("[auth] profile sync failed", error.message);
}

/** Who did it, from where: hashed IP + user agent (shared accounts like the council's address are used by several people). */
async function requestMeta() {
  try {
    const h = await headers();
    const ip = clientIp(h);
    return { ip_hash: ip !== "unknown" ? hashIp(ip) : null, ua: (h.get("user-agent") ?? "").slice(0, 200) };
  } catch {
    return {}; // outside a request
  }
}

export async function audit(actor: Pick<Session, "id" | "email">, action: string, table?: string, targetId?: string, detail: Record<string, unknown> = {}) {
  const { error } = await adminClient().from("audit_logs").insert({
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    target_table: table ?? null,
    target_id: targetId ?? null,
    detail: { ...(await requestMeta()), ...detail },
  });
  if (error) console.error("[audit] insert failed", error.message);
}
