import "server-only";
import { adminClient } from "@/lib/supabase/admin";

// admin_audit for the security page (security.view) and the data export (data.export). Entries older than one year
// are removed by public.prune_admin_audit() (called when the security page opens).

export type AuditRow = { id: number; actor_email: string | null; action: string; target: string | null; details: Record<string, unknown>; ip_hash: string | null; created_at: string };
export type AuditFilters = { actor?: string; action?: string; from?: string; to?: string; page: number };
export const AUDIT_PAGE = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
export function auditFilters(sp: Record<string, string | undefined>): AuditFilters {
  return {
    actor: sp.actor && /^[^\s,()]{3,254}$/.test(sp.actor) ? sp.actor.toLowerCase() : undefined,
    action: sp.action && /^[a-z0-9._:-]{2,60}$/.test(sp.action) ? sp.action : undefined,
    from: sp.from && DATE.test(sp.from) ? sp.from : undefined,
    to: sp.to && DATE.test(sp.to) ? sp.to : undefined,
    page: Math.max(1, Math.min(500, Number(sp.page) || 1)),
  };
}

export async function listAudit(f: AuditFilters, pageSize = AUDIT_PAGE) {
  let q = adminClient().from("admin_audit").select("id,actor_email,action,target,details,ip_hash,created_at", { count: "exact" }).order("created_at", { ascending: false });
  if (f.actor) q = q.eq("actor_email", f.actor);
  // "content" matches content.create, content.publish, ...
  if (f.action) q = f.action.includes(".") ? q.eq("action", f.action) : q.like("action", `${f.action}.%`);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+07:00`);
  if (f.to) q = q.lte("created_at", `${f.to}T23:59:59.999+07:00`);
  const start = (f.page - 1) * pageSize;
  const { data, count, error } = await q.range(start, start + pageSize - 1);
  if (error) throw new Error(`audit: ${error.message}`);
  return { rows: (data ?? []) as AuditRow[], total: count ?? 0 };
}

/** Distinct actors and action families of the last year, for the filter menus. */
export async function auditFacets() {
  const { data } = await adminClient().from("admin_audit").select("actor_email,action").order("created_at", { ascending: false }).limit(5000);
  const rows = data ?? [];
  const actors = [...new Set(rows.map((r) => r.actor_email as string | null).filter((x): x is string => !!x))].sort();
  const actions = [...new Set(rows.map((r) => String(r.action)))].sort();
  return { actors, actions, families: [...new Set(actions.map((a) => a.split(".")[0]))].sort() };
}

export async function pruneAudit() {
  const { data, error } = await adminClient().rpc("prune_admin_audit");
  if (error) console.error("[audit] prune", error.message);
  return Number(data ?? 0);
}
