import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { StatChart } from "@/components/admin/stats/StatChart";
import { BarList, Card, Empty, ErrorNote, PageHeader, RangeFilter } from "@/components/admin/stats/ui";
import { dayLabel, parseRange, visitReport } from "@/lib/admin/stats";
import { requireRole } from "@/lib/auth";

export default async function VisitsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string }> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const range = parseRange(sp.range);
  const [t, f] = await Promise.all([getTranslations("stats"), getFormatter()]);
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

  return (
    <div className="max-w-6xl space-y-6">
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
              <>
                <StatChart
                  type="line"
                  labels={data.series.map((s) => day(s.day))}
                  series={[
                    { label: t("visits.views"), data: data.series.map((s) => s.views) },
                    { label: t("visits.uniques"), data: data.series.map((s) => s.uniques) },
                  ]}
                  summary={`${t("visits.trend", { n: range })}: ${t("visits.views")} ${fmt(data.views)}, ${t("visits.uniques")} ${fmt(data.uniques)}`}
                  loading={t("loading")}
                />
                <p className="mt-3 text-xs text-muted">{t("visits.uniquesNote")}</p>
              </>
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
              <BarList items={data.devices.map((d) => ({ label: d.key === "mobile" ? t("visits.mobile") : t("visits.desktop"), n: d.n }))} empty={t("empty")} fmt={fmt} />
            </Card>
            <Card title={t("visits.countries")}>
              <BarList items={data.countries.map((c) => ({ label: c.key ? regionName(c.key) : t("visits.unknown"), n: c.n }))} empty={t("empty")} fmt={fmt} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
