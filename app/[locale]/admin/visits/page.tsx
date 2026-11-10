import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AreaChart } from "@/components/admin/charts/AreaChart";
import { ChartFrame } from "@/components/admin/charts/ChartFrame";
import { Donut } from "@/components/admin/charts/Donut";
import { Heatmap } from "@/components/admin/charts/Heatmap";
import { BarList, Card, Empty, ErrorNote, PageHeader, RangeFilter } from "@/components/admin/stats/ui";
import { dayLabel, parseRange, visitReport } from "@/lib/admin/stats";
import { requirePermission } from "@/lib/auth";

export default async function VisitsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string }> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  await requirePermission("stats.view");
  const range = parseRange(sp.range);
  const [t, ta, f] = await Promise.all([getTranslations("stats"), getTranslations("admin.charts"), getFormatter()]);
  const data = await visitReport(range).catch((e: Error) => (console.error("[admin] visits", e.message), null));
  const fmt = (n: number) => f.number(n);
  const day = dayLabel(locale);
  const region = new Intl.DisplayNames([locale], { type: "region" });
  const regionName = (c: string) => {
    try {
      return region.of(c) ?? c;
    } catch {
      return c;
    }
  };
  const frame = { table: ta("table"), chart: ta("chart") };
  const days = [1, 2, 3, 4, 5, 6, 7].map((d) => ta(`weekdays.${d}`));

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title={t("nav.visits")} lead={t("visits.lead")}>
        <RangeFilter pathname="/admin/visits" value={range} label={t("range.label")} days={(n) => t("range.days", { n })} />
      </PageHeader>
      {!data ? (
        <ErrorNote text={t("error")} />
      ) : (
        <>
          <Card
            title={t("visits.trend", { n: range })}
            aside={<>{t("visits.views")} <b className="tabular-nums text-ink">{fmt(data.views)}</b> · {t("visits.uniques")} <b className="tabular-nums text-ink">{fmt(data.uniques)}</b></>}
          >
            {data.views ? (
              <ChartFrame labels={frame} table={{ columns: [ta("day"), t("visits.views"), t("visits.uniques")], rows: data.series.map((s) => [day(s.day), s.views, s.uniques]) }}>
                <AreaChart
                  labels={data.series.map((s) => day(s.day))}
                  series={[{ label: t("visits.views"), data: data.series.map((s) => s.views) }, { label: t("visits.uniques"), data: data.series.map((s) => s.uniques) }]}
                  summary={`${t("visits.trend", { n: range })}: ${t("visits.views")} ${fmt(data.views)}, ${t("visits.uniques")} ${fmt(data.uniques)}`}
                />
                <p className="mt-3 text-xs text-muted">{t("visits.uniquesNote")}</p>
              </ChartFrame>
            ) : (
              <Empty text={t("empty")} />
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t("visits.pages")}>
              <BarList items={data.pages.map((p) => ({ label: p.key, n: p.n }))} empty={t("empty")} fmt={fmt} />
            </Card>
            <Card title={t("visits.refs")}>
              <BarList items={data.refs.map((r) => ({ label: r.key || t("visits.direct"), n: r.n }))} empty={t("empty")} fmt={fmt} />
            </Card>
            <Card title={t("visits.devices")}>
              {data.devices.length ? (
                <ChartFrame labels={frame} table={{ columns: [t("visits.devices"), t("visits.views")], rows: data.devices.map((d) => [d.key === "mobile" ? t("visits.mobile") : t("visits.desktop"), d.n]) }}>
                  <Donut
                    items={data.devices.map((d) => ({ label: d.key === "mobile" ? t("visits.mobile") : t("visits.desktop"), n: d.n }))}
                    centerLabel={t("visits.views")}
                    summary={`${t("visits.devices")}: ${data.devices.map((d) => `${d.key === "mobile" ? t("visits.mobile") : t("visits.desktop")} ${fmt(d.n)}`).join(", ")}`}
                  />
                </ChartFrame>
              ) : <Empty text={t("empty")} />}
            </Card>
            <Card title={t("visits.countries")}>
              <BarList items={data.countries.map((c) => ({ label: c.key ? regionName(c.key) : t("visits.unknown"), n: c.n }))} empty={t("empty")} fmt={fmt} />
            </Card>
          </div>

          <Card title={ta("heatmap")} aside={ta("heatmapNote")}>
            {Object.keys(data.hours).length ? (
              <ChartFrame
                labels={frame}
                table={{ columns: [ta("weekday"), ...Array.from({ length: 24 }, (_, h) => `${h}`)], rows: days.map((dl, i) => [dl, ...Array.from({ length: 24 }, (_, h) => data.hours[`${i + 1}-${String(h).padStart(2, "0")}`] ?? 0)]) }}
              >
                <Heatmap cells={data.hours} days={days} summary={ta("heatmap")} hourFormat={ta("hourFormat")} />
              </ChartFrame>
            ) : <Empty text={ta("heatmapEmpty")} />}
          </Card>
        </>
      )}
    </div>
  );
}
