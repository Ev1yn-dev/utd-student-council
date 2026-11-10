// Back-office roles and permissions: one table, used by the server checks (lib/auth.ts requirePermission), the menu,
// the users page and the tests (tests/permissions.test.ts). Pure TypeScript, no imports: safe on server and client.

export const ROLES = ["owner", "admin", "editor", "moderator", "viewer"] as const;
export type AdminRole = (typeof ROLES)[number];

export const PERMISSIONS = [
  "stats.view",
  "messages.read",
  "messages.identity.view",
  "messages.delete",
  "senders.block",
  "roster.import",
  "content.edit",
  "years.manage",
  "banners.edit",
  "consent.view",
  "users.manage",
  "data.export",
  "data.reset.view",
  "security.view",
  "settings.edit",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** What each role may do. owner and admin: everything (admin cannot change or remove owners: see checkUserChange). */
export const ROLE_PERMISSIONS: Record<AdminRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  editor: ["stats.view", "content.edit", "banners.edit", "consent.view", "years.manage"],
  moderator: ["stats.view", "messages.read", "messages.identity.view", "messages.delete", "senders.block"],
  viewer: ["stats.view"],
};

export const isRole = (v: unknown): v is AdminRole => typeof v === "string" && (ROLES as readonly string[]).includes(v);
export const isPermission = (v: unknown): v is Permission => typeof v === "string" && (PERMISSIONS as readonly string[]).includes(v);

/** The account as the permission checks see it (a row of public.admin_users). */
export type AdminAccount = { email: string; role: AdminRole; extra: readonly string[]; disabled: boolean };

/** Role permissions plus valid extra permissions; a disabled account has none. */
export function permissionsOf(a: Pick<AdminAccount, "role" | "extra" | "disabled"> | null): Set<Permission> {
  if (!a || a.disabled || !isRole(a.role)) return new Set();
  return new Set([...ROLE_PERMISSIONS[a.role], ...a.extra.filter(isPermission)]);
}

export const can = (a: Pick<AdminAccount, "role" | "extra" | "disabled"> | null, p: Permission) => permissionsOf(a).has(p);

/** A change on the users page: add an account, or change role / extra permissions / disabled of one, or remove it. */
export type UserChange =
  | { kind: "add"; role: AdminRole }
  | { kind: "update"; role?: AdminRole; extra?: readonly string[]; disabled?: boolean }
  | { kind: "remove" };

export type ChangeError = "forbidden" | "ownerOnly" | "lastOwner" | "self" | "badRole" | "badPermission";

/**
 * Whether `actor` may apply `change` to `target` (null for "add"). `activeOwners` = number of owners that are not
 * disabled, before the change. Rules:
 *   - users.manage is required;
 *   - only an owner may add, change or remove an owner, or make someone owner (admin: "all, but cannot change or remove owners");
 *   - the last active owner cannot be removed, demoted or disabled;
 *   - nobody removes, disables or changes the role of their own account (no lock-out by mistake; someone else does it).
 */
export function checkUserChange(actor: AdminAccount, target: AdminAccount | null, change: UserChange, activeOwners: number): ChangeError | null {
  if (!can(actor, "users.manage")) return "forbidden";
  const newRole = change.kind === "add" ? change.role : change.kind === "update" ? change.role : undefined;
  if (newRole !== undefined && !isRole(newRole)) return "badRole";
  if (change.kind === "update" && change.extra && !change.extra.every(isPermission)) return "badPermission";
  const touchesOwner = target?.role === "owner" || newRole === "owner";
  if (touchesOwner && actor.role !== "owner") return "ownerOnly";
  if (change.kind === "add") return null;
  if (!target) return "forbidden";
  if (target.email === actor.email && (change.kind === "remove" || change.disabled === true || (newRole !== undefined && newRole !== actor.role))) return "self";
  const losesOwner = target.role === "owner" && !target.disabled &&
    (change.kind === "remove" || change.disabled === true || (newRole !== undefined && newRole !== "owner"));
  if (losesOwner && activeOwners <= 1) return "lastOwner";
  return null;
}
