"use client";

import { ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { inviteUser, removeUser, updateUser, type UserResult } from "@/app/actions/users";
import { ICON } from "@/components/admin/icon";
import { toast } from "@/components/admin/live";
import { useRouter } from "@/i18n/navigation";
import { PERMISSIONS, ROLES, ROLE_PERMISSIONS, checkUserChange, type AdminAccount, type AdminRole, type Permission } from "@/lib/admin/permissions";
import type { AdminUser } from "@/lib/admin/users";
import { cn } from "@/lib/utils";

const field = "h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink";
const btn = "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-3.5 text-sm transition-colors duration-150 hover:border-brand-mid disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Users & permissions. Controls the current account may not use are disabled with the reason (same rules as the
 * server: lib/admin/permissions.ts checkUserChange); the server checks again on every change.
 */
export function AdminUsers({ users, me, owners }: { users: AdminUser[]; me: AdminAccount; owners: number }) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("admin.roles");
  const tp = useTranslations("admin.perms");
  const router = useRouter();
  const [busy, start] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);
  const handle = (r: UserResult) => {
    if (r.ok) {
      toast({ tone: "ok", text: t("saved") });
      router.refresh();
    } else toast({ tone: "error", text: t(`errors.${r.error}`) }, 7000);
  };
  const [state, invite, inviting] = useActionState<UserResult | null, FormData>(async (prev, fd) => {
    const r = await inviteUser(prev, fd);
    handle(r);
    return r;
  }, null);
  const run = (fn: () => Promise<UserResult>) => start(async () => handle(await fn()));
  const why = (u: AdminUser, change: Parameters<typeof checkUserChange>[2]) => checkUserChange(me, u, change, owners);

  return (
    <div className="space-y-6">
      <form action={invite} className="grid gap-3 rounded-[20px] border border-line bg-surface p-5 shadow-soft md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <label className="text-sm">
          <span className="text-muted">{t("email")}</span>
          <input name="email" type="email" required autoComplete="off" placeholder="name@utd.ac.th" className={cn(field, "mt-1 w-full")} />
        </label>
        <label className="text-sm">
          <span className="text-muted">{t("role")}</span>
          <select name="role" defaultValue="viewer" className={cn(field, "mt-1 w-full")}>
            {ROLES.map((r) => <option key={r} value={r} disabled={r === "owner" && me.role !== "owner"}>{tr(r)}</option>)}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name="shared" className="h-4 w-4" />{t("shared")}</label>
        <button type="submit" disabled={inviting} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-pink px-5 font-display font-semibold text-white disabled:opacity-60">
          <UserPlus {...ICON} />{t("invite")}
        </button>
        {state && !state.ok && <p role="alert" className="text-sm text-danger md:col-span-4">{t(`errors.${state.error}`)}</p>}
        <p className="text-xs text-muted md:col-span-4">{t("inviteHelp")}</p>
      </form>

      <ul className="space-y-3">
        {users.map((u) => {
          const roleBlock = why(u, { kind: "update", role: u.role === "owner" ? "admin" : "owner" });
          const canRole = !why(u, { kind: "update", role: u.role });
          const disableBlock = why(u, { kind: "update", disabled: !u.disabled });
          const removeBlock = why(u, { kind: "remove" });
          const extraBlock = why(u, { kind: "update", extra: u.extra });
          const fromRole = new Set<Permission>(ROLE_PERMISSIONS[u.role]);
          return (
            <li key={u.email} className={cn("rounded-[20px] border bg-surface p-4 shadow-soft", u.disabled ? "border-line opacity-75" : "border-line")}>
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                    <span className="truncate">{u.email}</span>
                    {u.email === me.email && <span className="rounded-full bg-sky px-2 py-0.5 text-xs">{t("you")}</span>}
                    {u.shared && <span className="rounded-full bg-progress/15 px-2 py-0.5 text-xs text-progress">{t("sharedBadge")}</span>}
                    {u.disabled && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">{t("disabled")}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{u.lastLogin ? t("lastLogin", { date: new Date(u.lastLogin).toLocaleString() }) : t("neverLoggedIn")} · {t("addedBy", { by: u.createdBy ?? "—" })}</p>
                </div>
                <label className="text-sm">
                  <span className="sr-only">{t("role")}</span>
                  <select
                    value={u.role}
                    disabled={busy || !canRole}
                    title={!canRole || roleBlock ? t(`errors.${roleBlock ?? "forbidden"}`) : undefined}
                    onChange={(e) => run(() => updateUser(u.email, { role: e.target.value as AdminRole }))}
                    className={field}
                  >
                    {ROLES.map((r) => <option key={r} value={r} disabled={!!why(u, { kind: "update", role: r }) && r !== u.role}>{tr(r)}</option>)}
                  </select>
                </label>
                <button type="button" className={btn} disabled={busy || !!disableBlock} title={disableBlock ? t(`errors.${disableBlock}`) : undefined}
                  onClick={() => run(() => updateUser(u.email, { disabled: !u.disabled }))}>
                  {u.disabled ? t("enable") : t("disable")}
                </button>
                <button type="button" className={btn} disabled={busy} onClick={() => run(() => updateUser(u.email, { shared: !u.shared }))}>
                  {u.shared ? t("unmarkShared") : t("markShared")}
                </button>
                {confirm === u.email ? (
                  <span className="flex gap-1">
                    <button type="button" className={cn(btn, "border-danger bg-danger text-white")} disabled={busy} onClick={() => run(() => removeUser(u.email))}>{t("confirmRemove")}</button>
                    <button type="button" className={btn} onClick={() => setConfirm(null)}>{t("cancel")}</button>
                  </span>
                ) : (
                  <button type="button" className={cn(btn, "text-danger")} disabled={busy || !!removeBlock} title={removeBlock ? t(`errors.${removeBlock}`) : undefined}
                    onClick={() => setConfirm(u.email)} aria-label={t("removeOf", { email: u.email })}>
                    <Trash2 {...ICON} />{t("remove")}
                  </button>
                )}
              </div>
              <details className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <summary className="flex cursor-pointer items-center gap-2 text-muted">
                  <ShieldCheck {...ICON} size={16} />
                  {t("permissions", { n: fromRole.size + u.extra.filter((p) => !fromRole.has(p as Permission)).length })}
                </summary>
                <fieldset className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3" disabled={busy || !!extraBlock}>
                  <legend className="sr-only">{t("extraLegend", { email: u.email })}</legend>
                  {PERMISSIONS.map((p) => {
                    const byRole = fromRole.has(p);
                    const on = byRole || u.extra.includes(p);
                    return (
                      <label key={p} className={cn("flex items-start gap-2 rounded-lg px-2 py-1", byRole && "text-muted")}>
                        <input
                          type="checkbox" className="mt-0.5 h-4 w-4" checked={on} disabled={byRole}
                          onChange={(e) => run(() => updateUser(u.email, { extra: e.target.checked ? [...u.extra, p] : u.extra.filter((x) => x !== p) }))}
                        />
                        <span>
                          <span className="block">{tp(p.replace(/\./g, "_"))}</span>
                          <span className="block font-mono text-[11px] text-muted">{p}{byRole ? ` · ${t("fromRole")}` : ""}</span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
