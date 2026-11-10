import { Filter } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { after } from "next/server";
import { ICON } from "@/components/admin/icon";
import { Card, ErrorNote, PageHeader } from "@/components/admin/stats/ui";
import { Link } from "@/i18n/navigation";
import { AUDIT_PAGE, auditFacets, auditFilters, listAudit, pruneAudit } from "@/lib/admin/audit-log";
import { requirePermission } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { cn } from "@/lib/utils";

type SP = { actor?: string; action?: string; from?: string; to?: string; page?: string };
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
type Event = { kind: string; path: string | null; ip_hash: string | null; created_at: string };

/** security.view: security events of the last 7 days, the admin audit log (filters: actor, action, date) and "sign out everywhere". */
export default async function SecurityPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  await requirePermission("security.view");
  after(() => pruneAudit()); // keep one year
  const fl = auditFilters(sp);
  const [t, ta, f, { data: ev }, log, facets] = await Promise.all([
    getTranslations("security"), getTranslations("admin.audit"), getFormatter(),
    adminClient().from("security_events").select("kind,path,ip_hash,created_at").gte("created_at", daysAgo(7)).order("created_at", { ascending: false }).limit(500),
    listAudit(fl).catch((e: Error) => (console.error("[admin] audit", e.message), null)),
    auditFacets().catch(() => ({ actors: [] as string[], actions: [] as string[], families: [] as string[] })),
  ]);
  const events = (ev ?? []) as Event[];
  const counts = Object.entries(events.reduce<Record<string, number>>((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const when = (v: string) => f.dateTime(new Date(v), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });
  const pages = log ? Math.max(1, Math.ceil(log.total / AUDIT_PAGE)) : 1;
  const query = (page: number) => ({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== "page" && v)), page: String(page) });
  const field = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink";
  const actionName = (a: string) => (ta.has(`actions.${a}`) ? ta(`actions.${a}`) : a);
  const detail = (d: Record<string, unknown>) =>
    Object.entries(d).filter(([k]) => k !== "ua").map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ");

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title={t("title")} lead={t("lead")} />

      <Card title={t("summary")}>
        {counts.length ? (
          <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {counts.map(([k, n]) => (
              <li key={k} className="rounded-xl bg-surface-2 px-3 py-2">
                <span className="block font-display text-2xl font-semibold tabular-nums">{n}</span>
                <span className="text-sm text-muted">{t.has(`kinds.${k}`) ? t(`kinds.${k}`) : k}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("none")}</p>
        )}
      </Card>

      <Card title={ta("title")} aside={ta("keep")}>
        <form method="get" aria-label={ta("filters")} className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs text-muted">{ta("actor")}
            <select name="actor" defaultValue={fl.actor ?? ""} className={field}>
              <option value="">{ta("all")}</option>
              {facets.actors.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">{ta("action")}
            <select name="action" defaultValue={fl.action ?? ""} className={field}>
              <option value="">{ta("all")}</option>
              {facets.families.map((fam) => (
                <optgroup key={fam} label={ta.has(`families.${fam}`) ? ta(`families.${fam}`) : fam}>
                  <option value={fam}>{ta("allOf", { family: ta.has(`families.${fam}`) ? ta(`families.${fam}`) : fam })}</option>
                  {facets.actions.filter((a) => a.startsWith(`${fam}.`)).map((a) => <option key={a} value={a}>{actionName(a)}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">{ta("from")}<input type="date" name="from" defaultValue={fl.from ?? ""} className={field} /></label>
          <label className="text-xs text-muted">{ta("to")}<input type="date" name="to" defaultValue={fl.to ?? ""} className={field} /></label>
          <div className="flex items-end gap-2">
            <button type="submit" className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-on-brand"><Filter {...ICON} />{ta("apply")}</button>
            <Link href="/admin/security" className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink">{ta("clear")}</Link>
          </div>
        </form>
        {!log ? (
          <ErrorNote text={ta("error")} />
        ) : log.rows.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-muted">{t("none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">{ta("title")}</caption>
              <thead className="text-xs text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">{t("time")}</th>
                  <th scope="col" className="pr-3 font-medium">{ta("actor")}</th>
                  <th scope="col" className="pr-3 font-medium">{ta("action")}</th>
                  <th scope="col" className="pr-3 font-medium">{ta("target")}</th>
                  <th scope="col" className="pr-3 font-medium">{ta("details")}</th>
                  <th scope="col" className="font-medium">{t("source")}</th>
                </tr>
              </thead>
              <tbody>
                {log.rows.map((r) => (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{when(r.created_at)}</td>
                    <td className="max-w-[14rem] truncate pr-3">{r.actor_email ?? "—"}</td>
                    <td className="pr-3"><span className={cn("rounded-full px-2 py-0.5 text-xs", r.action.startsWith("auth.") ? "bg-surface-2" : r.action.includes("delete") || r.action.includes("block") ? "bg-danger/10 text-danger" : "bg-sky text-ink")}>{actionName(r.action)}</span></td>
                    <td className="max-w-[14rem] truncate pr-3 font-mono text-xs">{r.target ?? "—"}</td>
                    <td className="max-w-[20rem] truncate pr-3 text-xs text-muted" title={detail(r.details)}>{detail(r.details) || "—"}</td>
                    <td className="font-mono text-xs">{r.ip_hash?.slice(0, 8) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {log && pages > 1 && (
          <nav className="mt-4 flex items-center justify-between text-sm" aria-label={ta("page", { page: fl.page, pages })}>
            {fl.page > 1 ? <Link href={{ pathname: "/admin/security", query: query(fl.page - 1) }} className="rounded-full border border-line px-4 py-2">← {ta("prev")}</Link> : <span />}
            <span className="text-muted">{ta("page", { page: fl.page, pages })}</span>
            {fl.page < pages ? <Link href={{ pathname: "/admin/security", query: query(fl.page + 1) }} className="rounded-full border border-line px-4 py-2">{ta("next")} →</Link> : <span />}
          </nav>
        )}
      </Card>

      <Card title={t("recent")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted"><tr><th className="py-1 pr-3 font-medium">{t("time")}</th><th className="pr-3 font-medium">{t("kind")}</th><th className="pr-3 font-medium">{t("path")}</th><th className="font-medium">{t("source")}</th></tr></thead>
            <tbody>
              {events.slice(0, 50).map((e, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="whitespace-nowrap py-1.5 pr-3">{when(e.created_at)}</td>
                  <td className="pr-3">{t.has(`kinds.${e.kind}`) ? t(`kinds.${e.kind}`) : e.kind}</td>
                  <td className="max-w-[16rem] truncate pr-3 font-mono text-xs">{e.path ?? "—"}</td>
                  <td className="font-mono text-xs">{e.ip_hash?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="rounded-[20px] border border-danger/30 bg-surface p-5">
        <h2 className="font-display font-semibold">{t("logoutAll")}</h2>
        <p className="mt-1 text-sm text-muted">{t("logoutAllHelp")}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <input type="hidden" name="scope" value="global" />
          <button type="submit" className="min-h-10 cursor-pointer rounded-full bg-danger px-4 text-sm font-semibold text-white">{t("logoutAll")}</button>
        </form>
      </section>
    </div>
  );
}
