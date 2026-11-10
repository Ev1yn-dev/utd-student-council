"use server";

import { revalidatePath } from "next/cache";
import { checkUserChange, isPermission, isRole, type AdminRole, type UserChange } from "@/lib/admin/permissions";
import { EMAIL_RE, activeOwnerCount, deleteAdminUser, getAdminUser, insertAdminUser, updateAdminUser } from "@/lib/admin/users";
import { audit, authorizePermission, type AdminSession } from "@/lib/auth";
import { normalizeEmail } from "@/lib/env";

// Users and permissions (users.manage). Each change is checked on the server against lib/admin/permissions.ts
// checkUserChange (owner-only changes, last owner, own account) — the database trigger guards the last owner again —
// and written to admin_audit. Error = message key under admin.users.errors.

export type UserResult = { ok: true } | { ok: false; error: string };
type Patch = { role?: AdminRole; extra?: string[]; disabled?: boolean; shared?: boolean };

const me = (s: AdminSession) => ({ email: s.email, role: s.role, extra: s.extra, disabled: false });
const done = (): UserResult => {
  revalidatePath("/[locale]/admin", "layout");
  return { ok: true };
};

export async function inviteUser(_prev: UserResult | null, fd: FormData): Promise<UserResult> {
  const s = await authorizePermission("users.manage");
  if (!s) return { ok: false, error: "forbidden" };
  const email = normalizeEmail(String(fd.get("email") ?? ""));
  const role = String(fd.get("role") ?? "");
  const shared = fd.get("shared") === "on";
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "badEmail" };
  if (!isRole(role)) return { ok: false, error: "badRole" };
  const err = checkUserChange(me(s), null, { kind: "add", role }, await activeOwnerCount());
  if (err) return { ok: false, error: err };
  const dbErr = await insertAdminUser(email, role, shared, s.email).catch(() => "saveFailed" as const);
  if (dbErr) return { ok: false, error: dbErr };
  await audit(s, "user.invite", email, { role, shared });
  return done();
}

/** Role, extra permissions, disabled or shared of one account. */
export async function updateUser(email: string, patch: Patch): Promise<UserResult> {
  const s = await authorizePermission("users.manage");
  if (!s) return { ok: false, error: "forbidden" };
  const target = await getAdminUser(String(email ?? ""));
  if (!target) return { ok: false, error: "notFound" };
  const clean: Patch = {};
  if (patch?.role !== undefined) {
    if (!isRole(patch.role)) return { ok: false, error: "badRole" };
    clean.role = patch.role;
  }
  if (patch?.extra !== undefined) {
    if (!Array.isArray(patch.extra) || !patch.extra.every(isPermission)) return { ok: false, error: "badPermission" };
    clean.extra = [...new Set(patch.extra)];
  }
  if (typeof patch?.disabled === "boolean") clean.disabled = patch.disabled;
  if (typeof patch?.shared === "boolean") clean.shared = patch.shared;
  if (!Object.keys(clean).length) return { ok: false, error: "badRequest" };

  const change: UserChange = { kind: "update", role: clean.role, extra: clean.extra, disabled: clean.disabled };
  const err = checkUserChange(me(s), target, change, await activeOwnerCount());
  if (err) return { ok: false, error: err };
  const dbErr = await updateAdminUser(target.email, {
    ...(clean.role ? { role: clean.role } : {}), ...(clean.extra ? { extra_permissions: clean.extra } : {}),
    ...(clean.disabled !== undefined ? { disabled: clean.disabled } : {}), ...(clean.shared !== undefined ? { shared: clean.shared } : {}),
  }).catch(() => "saveFailed" as const);
  if (dbErr) return { ok: false, error: dbErr };

  if (clean.role && clean.role !== target.role) await audit(s, "user.role", target.email, { from: target.role, to: clean.role });
  if (clean.extra) await audit(s, "user.permissions", target.email, { from: target.extra, to: clean.extra });
  if (clean.disabled !== undefined && clean.disabled !== target.disabled) await audit(s, clean.disabled ? "user.disable" : "user.enable", target.email);
  if (clean.shared !== undefined && clean.shared !== target.shared) await audit(s, "user.shared", target.email, { shared: clean.shared });
  return done();
}

export async function removeUser(email: string): Promise<UserResult> {
  const s = await authorizePermission("users.manage");
  if (!s) return { ok: false, error: "forbidden" };
  const target = await getAdminUser(String(email ?? ""));
  if (!target) return { ok: false, error: "notFound" };
  const err = checkUserChange(me(s), target, { kind: "remove" }, await activeOwnerCount());
  if (err) return { ok: false, error: err };
  const dbErr = await deleteAdminUser(target.email).catch(() => "saveFailed" as const);
  if (dbErr) return { ok: false, error: dbErr };
  await audit(s, "user.remove", target.email, { role: target.role });
  return done();
}
