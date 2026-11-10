import "server-only";
import type { AdminAccount, AdminRole } from "@/lib/admin/permissions";
import { normalizeEmail } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";

// public.admin_users: who may use the back office, with which role and extra permissions. Read / written with the
// service role after the caller passed users.manage (app/actions/users.ts); the table is closed to every token.

export type AdminUser = AdminAccount & { shared: boolean; createdAt: string; createdBy: string | null; lastLogin: string | null };
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Row = { email: string; role: AdminRole; extra_permissions: string[] | null; disabled: boolean; shared: boolean; created_at: string; created_by: string | null };
const toUser = (r: Row, lastLogin: string | null = null): AdminUser => ({
  email: r.email, role: r.role, extra: r.extra_permissions ?? [], disabled: !!r.disabled, shared: !!r.shared,
  createdAt: r.created_at, createdBy: r.created_by ?? null, lastLogin,
});
const COLS = "email,role,extra_permissions,disabled,shared,created_at,created_by";

export async function listAdminUsers(): Promise<AdminUser[]> {
  const db = adminClient();
  const [{ data }, { data: profiles }] = await Promise.all([
    db.from("admin_users").select(COLS).order("created_at"),
    db.from("profiles").select("email,last_login_at").not("email", "is", null),
  ]);
  const seen = new Map((profiles ?? []).map((p) => [p.email as string, (p.last_login_at as string | null) ?? null]));
  return ((data ?? []) as Row[]).map((r) => toUser(r, seen.get(r.email) ?? null));
}

export async function getAdminUser(email: string): Promise<AdminUser | null> {
  const { data } = await adminClient().from("admin_users").select(COLS).eq("email", normalizeEmail(email)).maybeSingle();
  return data ? toUser(data as Row) : null;
}

export async function activeOwnerCount(): Promise<number> {
  const { count } = await adminClient().from("admin_users").select("email", { count: "exact", head: true }).eq("role", "owner").eq("disabled", false);
  return count ?? 0;
}

/** "lastOwner" when the database trigger refused the change (migration 0019), else the error is thrown. */
function check(error: { code?: string; message: string } | null) {
  if (!error) return null;
  if (error.code === "P0001" && /last owner/.test(error.message)) return "lastOwner" as const;
  if (error.code === "23505") return "exists" as const;
  throw new Error(error.message);
}

export async function insertAdminUser(email: string, role: AdminRole, shared: boolean, by: string) {
  const { error } = await adminClient().from("admin_users").insert({ email: normalizeEmail(email), role, shared, created_by: by });
  return check(error);
}

export async function updateAdminUser(email: string, patch: Partial<{ role: AdminRole; extra_permissions: string[]; disabled: boolean; shared: boolean }>) {
  const { error } = await adminClient().from("admin_users").update(patch).eq("email", normalizeEmail(email));
  return check(error);
}

export async function deleteAdminUser(email: string) {
  const { error } = await adminClient().from("admin_users").delete().eq("email", normalizeEmail(email));
  return check(error);
}

/** Shared accounts that can sign in now — flagged on the settings page. */
export async function activeSharedAccounts() {
  const { data } = await adminClient().from("admin_users").select("email").eq("shared", true).eq("disabled", false);
  return (data ?? []).map((r) => r.email as string);
}
