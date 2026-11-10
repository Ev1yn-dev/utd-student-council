import { Trophy } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AreaChart } from "@/components/admin/charts/AreaChart";
import { ChartFrame } from "@/components/admin/charts/ChartFrame";
import { GradeDrill } from "@/components/admin/charts/GradeDrill";
import { ICON } from "@/components/admin/icon";
import { BarList, Card, Empty, ErrorNote, PageHeader, RangeFilter } from "@/components/admin/stats/ui";
import { dayLabel, parseRange, voiceReport } from "@/lib/admin/stats";
import { requirePermission } from "@/lib/auth";
import { VOICE_CATEGORIES } from "@/lib/site";

/** Council voice statistics: counts only (per day, grade, room and topic). Reading the messages is not part of this page. */
export default async function VoiceStatsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string }> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  await requirePermission("stats.view");
  const range = parseRange(sp.range);
  const [t, tv, ta, f] = await Promise.all([getTranslations("stats"), getTranslations("voice"), getTranslations("admin.charts"), getFormatter()]);
  const data = await voiceReport(range).catch((e: Error) => (console.error("[admin] voice", e.message), null));
  const fmt = (n: number) => f.number(n);
  const day = dayLabel(locale);
  const gradeName = (g: number) => tv("gradeLabel", { g });
  const topicName = (k: string) => (k in VOICE_CATEGORIES ? tv(`categories.${VOICE_CATEGORIES[k as keyof typeof VOICE_CATEGORIES]}`) : k);
  const frame = { table: ta("table"), chart: ta("chart") };

  const graded = data ? data.grades.reduce((a, g) => a + g.n, 0) : 0;
  const ranking = data ? [...data.grades].sort((a, b) => b.n - a.n || a.grade - b.grade) : [];
  // a single clear leader only (a tie has no "most")
  const leader = ranking[0]?.n && ranking[1]?.n !== ranking[0].n ? ranking[0] : null;
  const total = data ? t("voice.total", { n: data.total }) : "";

  return (
    <div className="max-w-7xl space-y-6">
      <PageHeader title={t("nav.voice")} lead={t("voice.lead")}>
        <RangeFilter pathname="/admin/voice" value={range} label={t("range.label")} days={(n) => t("range.days", { n })} />
      </PageHeader>
      {!data ? (
        <ErrorNote text={t("error")} />
      ) : (
        <>
          {leader && (
            <p className="flex items-center gap-2 rounded-[20px] border border-pink/30 bg-pink-soft px-5 py-4 font-display text-lg font-semibold text-strong">
              <Trophy {...ICON} size={20} className="shrink-0 text-pink-ink" />
              {t("voice.top", { grade: gradeName(leader.grade), n: leader.n })}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3" title={t("voice.byGrade")} aside={total}>
              {graded ? (
                <ChartFrame
                  labels={frame}
                  table={{
                    columns: [t("voice.rank"), t("voice.grade"), t("voice.count"), t("voice.share")],
                    rows: ranking.map((g, i) => [String(i + 1), gradeName(g.grade), g.n, `${Math.round((g.n / graded) * 100)}%`]),
                  }}
                >
                  <GradeDrill
                    grades={data.grades} rooms={data.rooms} top={leader?.grade ?? null}
                    summary={`${t("voice.byGrade")}: ${data.grades.map((g) => `${gradeName(g.grade)} ${g.n}`).join(", ")}`}
                    gradeFormat={tv.raw("gradeLabel") as string} roomFormat={ta.raw("room") as string}
                    roomsTitle={ta.raw("roomsTitle") as string} roomsHint={ta("roomsHint")} noRooms={ta("noRooms")} showRooms={ta.raw("showRooms") as string}
                  />
                </ChartFrame>
              ) : (
                <Empty text={t("empty")} />
              )}
              {data.noGrade > 0 && <p className="mt-3 text-xs text-muted">{t("voice.noGrade")}: {fmt(data.noGrade)}</p>}
            </Card>

            <Card className="lg:col-span-2" title={t("voice.byTopic")}>
              <BarList items={data.categories.map((c) => ({ label: topicName(c.key), n: c.n }))} empty={t("empty")} fmt={fmt} />
            </Card>
          </div>

          <Card title={t("voice.trend", { n: range })} aside={total}>
            {data.total ? (
              <ChartFrame labels={frame} table={{ columns: [ta("day"), t("voice.count")], rows: data.series.map((s) => [day(s.day), s.n]) }}>
                <AreaChart
                  labels={data.series.map((s) => day(s.day))}
                  series={[{ label: t("voice.count"), data: data.series.map((s) => s.n) }]}
                  summary={`${t("voice.trend", { n: range })}: ${total}`}
                  height={220}
                />
              </ChartFrame>
            ) : (
              <Empty text={t("empty")} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
