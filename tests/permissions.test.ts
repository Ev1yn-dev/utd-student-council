import { beforeAll, describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, can, checkUserChange, permissionsOf, type AdminAccount, type AdminRole, type Permission } from "../lib/admin/permissions";

// The role matrix as specified (written out here on purpose, independent of ROLE_PERMISSIONS in the code).
const SPEC: Record<AdminRole, Permission[] | "all"> = {
  owner: "all",
  admin: "all",
  editor: ["stats.view", "content.edit", "banners.edit", "consent.view", "years.manage"],
  moderator: ["stats.view", "messages.read", "messages.identity.view", "messages.delete", "senders.block"],
  viewer: ["stats.view"],
};

const acct = (email: string, role: AdminRole, extra: string[] = [], disabled = false): AdminAccount => ({ email, role, extra, disabled });

describe("role × permission", () => {
  for (const role of ROLES) {
    for (const perm of PERMISSIONS) {
      const allowed = SPEC[role] === "all" || (SPEC[role] as Permission[]).includes(perm);
      it(`${role} ${allowed ? "may" : "may not"} ${perm}`, () => {
        expect(can(acct("x@utd.ac.th", role), perm)).toBe(allowed);
      });
    }
  }

  it("every permission string is covered", () => {
    expect(PERMISSIONS).toHaveLength(15);
  });

  it("extra permissions add to the role, unknown strings are ignored", () => {
    const a = acct("v@utd.ac.th", "viewer", ["data.export", "not.a.permission"]);
    expect(can(a, "data.export")).toBe(true);
    expect(can(a, "users.manage")).toBe(false);
    expect([...permissionsOf(a)].sort()).toEqual(["data.export", "stats.view"]);
  });

  it("a disabled account has no permission at all", () => {
    for (const role of ROLES) expect(permissionsOf(acct("d@utd.ac.th", role, ["data.export"], true)).size).toBe(0);
  });
});

describe("user changes: owners and the last owner", () => {
  const owner = acct("owner@utd.ac.th", "owner");
  const owner2 = acct("owner2@utd.ac.th", "owner");
  const admin = acct("admin@utd.ac.th", "admin");
  const editor = acct("editor@utd.ac.th", "editor");

  it("the last owner cannot be removed, demoted or disabled (by another owner)", () => {
    // owner2 acts on `owner`, who is the only active owner (owner2 counted elsewhere as disabled: activeOwners = 1)
    const actor = acct("other.owner@utd.ac.th", "owner");
    expect(checkUserChange(actor, owner, { kind: "remove" }, 1)).toBe("lastOwner");
    expect(checkUserChange(actor, owner, { kind: "update", role: "admin" }, 1)).toBe("lastOwner");
    expect(checkUserChange(actor, owner, { kind: "update", disabled: true }, 1)).toBe("lastOwner");
  });

  it("with a second active owner, an owner may demote / disable / remove another owner", () => {
    expect(checkUserChange(owner, owner2, { kind: "update", role: "admin" }, 2)).toBeNull();
    expect(checkUserChange(owner, owner2, { kind: "update", disabled: true }, 2)).toBeNull();
    expect(checkUserChange(owner, owner2, { kind: "remove" }, 2)).toBeNull();
  });

  it("nobody removes, disables or demotes their own account", () => {
    expect(checkUserChange(owner, owner, { kind: "remove" }, 2)).toBe("self");
    expect(checkUserChange(owner, owner, { kind: "update", disabled: true }, 2)).toBe("self");
    expect(checkUserChange(owner, owner, { kind: "update", role: "admin" }, 2)).toBe("self");
    expect(checkUserChange(owner, owner, { kind: "update", extra: [] }, 2)).toBeNull();
  });

  it("admin: all user management, but cannot change or remove owners, nor make someone owner", () => {
    expect(checkUserChange(admin, editor, { kind: "update", role: "moderator" }, 1)).toBeNull();
    expect(checkUserChange(admin, editor, { kind: "update", disabled: true }, 1)).toBeNull();
    expect(checkUserChange(admin, editor, { kind: "remove" }, 1)).toBeNull();
    expect(checkUserChange(admin, null, { kind: "add", role: "editor" }, 1)).toBeNull();
    expect(checkUserChange(admin, owner, { kind: "update", role: "admin" }, 2)).toBe("ownerOnly");
    expect(checkUserChange(admin, owner, { kind: "update", disabled: true }, 2)).toBe("ownerOnly");
    expect(checkUserChange(admin, owner, { kind: "update", extra: ["data.export"] }, 2)).toBe("ownerOnly");
    expect(checkUserChange(admin, owner, { kind: "remove" }, 2)).toBe("ownerOnly");
    expect(checkUserChange(admin, editor, { kind: "update", role: "owner" }, 1)).toBe("ownerOnly");
    expect(checkUserChange(admin, null, { kind: "add", role: "owner" }, 1)).toBe("ownerOnly");
  });

  it("without users.manage nothing can be changed", () => {
    for (const role of ["editor", "moderator", "viewer"] as const) {
      expect(checkUserChange(acct("r@utd.ac.th", role), editor, { kind: "update", role: "viewer" }, 1)).toBe("forbidden");
      expect(checkUserChange(acct("r@utd.ac.th", role), null, { kind: "add", role: "viewer" }, 1)).toBe("forbidden");
    }
    // ...unless it was granted as an extra permission (still not over owners)
    const lead = acct("lead@utd.ac.th", "editor", ["users.manage"]);
    expect(checkUserChange(lead, null, { kind: "add", role: "viewer" }, 1)).toBeNull();
    expect(checkUserChange(lead, owner, { kind: "update", disabled: true }, 2)).toBe("ownerOnly");
  });

  it("rejects unknown roles and permissions", () => {
    expect(checkUserChange(owner, editor, { kind: "update", role: "root" as AdminRole }, 1)).toBe("badRole");
    expect(checkUserChange(owner, editor, { kind: "update", extra: ["everything"] }, 1)).toBe("badPermission");
  });
});

describe("sign-in decision (lib/env.ts decideAccess)", () => {
  let decideAccess: typeof import("../lib/env").decideAccess;
  beforeAll(async () => {
    process.env.ALLOWED_EMAIL_DOMAIN = "utd.ac.th";
    process.env.ADMIN_EMAILS = " Site.Admin@gmail.com , other.admin@utd.ac.th";
    ({ decideAccess } = await import("../lib/env"));
  });
  const row = (role: string, disabled = false) => ({ role, disabled });

  it.each([
    // Google must have verified the address; malformed addresses never pass
    ["site.admin@gmail.com", false, null, "denied"],
    ["a@b@utd.ac.th", true, row("editor"), "denied"],
    ["", true, null, "denied"],
    // a row in admin_users decides: its role, or denied when disabled
    ["editor@utd.ac.th", true, row("editor"), "editor"],
    ["outside.teacher@gmail.com", true, row("moderator"), "moderator"],
    ["shared.council@utd.ac.th", true, row("viewer", true), "denied"],
    ["x@utd.ac.th", true, row("superuser"), "denied"],
    // ADMIN_EMAILS only bootstraps: no row -> owner; a row wins (a disabled bootstrap owner stays out)
    ["  SITE.ADMIN@GMAIL.COM ", true, null, "owner"],
    ["other.admin@utd.ac.th", true, row("viewer"), "viewer"],
    ["site.admin@gmail.com", true, row("owner", true), "denied"],
    // school address without a row -> signed in, no back office; anything else refused
    ["student@utd.ac.th", true, null, "pending"],
    ["someone.else@gmail.com", true, null, "denied"],
    ["x@utd.ac.th.evil.com", true, null, "denied"],
    ["x@evilutd.ac.th", true, null, "denied"],
  ] as const)("%s verified=%s row=%j -> %s", (email, verified, r, want) => {
    expect(decideAccess(email, verified, r)).toBe(want);
  });
});
