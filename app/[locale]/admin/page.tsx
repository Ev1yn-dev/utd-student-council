import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ErrorNote, PageHeader, StatCard, delta } from "@/components/admin/stats/ui";
import { overview } from "@/lib/admin/stats";
import { requireRole } from "@/lib/auth";

/** Admin overview: four headline numbers, each against the period before it. */
export default async function AdminOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const [t, f] = await Promise.all([getTranslations("stats"), getFormatter()]);
  const to = (k: string, v?: Record<string, number>) => t(`overview.${k}`, v);
  const data = await overview().catch((e: Error) => (console.error("[admin] overview", e.message), null));

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("nav.overview")} lead={to("lead")} />
      {!data ? (
        <ErrorNote text={t("error")} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <li><StatCard href="/admin/visits?range=7" label={to("today")} value={f.number(data.today.now)} change={delta(data.today.now, data.today.prev, to)} compare={to("vsYesterday")} /></li>
          <li><StatCard href="/admin/visits?range=7" label={to("views7")} value={f.number(data.views7.now)} change={delta(data.views7.now, data.views7.prev, to)} compare={to("vsPrev")} /></li>
          <li><StatCard href="/admin/visits?range=7" label={to("uniques7")} value={f.number(data.uniques7.now)} change={delta(data.uniques7.now, data.uniques7.prev, to)} compare={to("vsPrev")} /></li>
          <li><StatCard href="/admin/voice?range=7" label={to("voice7")} value={f.number(data.voice7.now)} change={delta(data.voice7.now, data.voice7.prev, to)} compare={to("vsPrev")} /></li>
        </ul>
      )}
    </div>
  );
}
