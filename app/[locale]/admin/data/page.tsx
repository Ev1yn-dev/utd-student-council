import { Download } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ICON } from "@/components/admin/icon";
import { Card, PageHeader } from "@/components/admin/stats/ui";
import { yearParam } from "@/lib/admin/data";
import { hasPermission, requirePermission } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { ceYear } from "@/lib/utils";

/** What is stored, how long it is kept, and how many rows there are now (data.reset.view). */
const STORES = [
  { table: "visit_stats", keep: "visits90" },
  { table: "visit_uniques", keep: "visits90" },
  { table: "voice_messages", keep: "manual" },
  { table: "voice_blocks", keep: "manual" },
  { table: "student_roster", keep: "roster" },
  { table: "security_events", keep: "manual" },
  { table: "admin_audit", keep: "year1" },
] as const;

/**
 * Data & reset: CSV exports (data.export) and the stored data with its retention (data.reset.view). Nothing is
 * deleted from here: automatic clean-ups are listed; a manual reset is done in the database by an owner.
 */
export default async function DataPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ year?: string }> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const s = await requirePermission("data.export", "data.reset.view");
  const canExport = hasPermission(s, "data.export");
  const canView = hasPermission(s, "data.reset.view");
  const [t, { year }] = await Promise.all([getTranslations("admin.data"), yearParam(sp.year, s.prefYear)]);
  const counts = canView
    ? await Promise.all(STORES.map(async (x) => ({ ...x, n: (await adminClient().from(x.table).select("*", { count: "exact", head: true })).count ?? 0 })))
    : [];
  const exports = [
    { kind: "content", href: `/api/admin/export?kind=content&year=${year}`, label: t("export.content", { be: year, ce: ceYear(year) }), show: true },
    { kind: "visits", href: "/api/admin/export?kind=visits", label: t("export.visits"), show: true },
    { kind: "messages", href: "/api/admin/export?kind=messages", label: hasPermission(s, "messages.identity.view") ? t("export.messagesIdentity") : t("export.messages"), show: hasPermission(s, "messages.read") },
    { kind: "audit", href: "/api/admin/export?kind=audit", label: t("export.audit"), show: hasPermission(s, "security.view") },
  ].filter((e) => e.show);

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("title")} lead={t("lead")} />
      {canExport && (
        <Card title={t("export.title")} aside={t("export.note")}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {exports.map((e) => (
              <li key={e.kind}>
                {/* a plain link: a file download, not a page (no prefetch) */}
                <a href={e.href} download className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 text-sm text-ink transition-colors duration-150 hover:border-pink hover:text-pink-ink">
                  <Download {...ICON} />{e.label}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {canView && (
        <Card title={t("reset.title")}>
          <p className="mb-3 text-sm text-muted">{t("reset.lead")}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr><th scope="col" className="py-2 pr-3 font-medium">{t("reset.store")}</th><th scope="col" className="pr-3 text-right font-medium">{t("reset.rows")}</th><th scope="col" className="font-medium">{t("reset.keep")}</th></tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c.table} className="border-t border-line">
                    <th scope="row" className="py-2 pr-3 font-normal">{t(`reset.tables.${c.table}`)} <span className="font-mono text-xs text-muted">{c.table}</span></th>
                    <td className="pr-3 text-right tabular-nums">{c.n.toLocaleString()}</td>
                    <td className="text-muted">{t(`reset.keeps.${c.keep}`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">{t("reset.how")}</p>
        </Card>
      )}
    </div>
  );
}
