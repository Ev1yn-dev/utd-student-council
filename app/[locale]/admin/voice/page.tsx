import { Trophy } from "@phosphor-icons/react/ssr";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { StatChart } from "@/components/admin/stats/StatChart";
import { BarList, Card, Empty, ErrorNote, PageHeader, RangeFilter } from "@/components/admin/stats/ui";
import { dayLabel, parseRange, voiceReport } from "@/lib/admin/stats";
import { requireRole } from "@/lib/auth";
import { VOICE_CATEGORIES } from "@/lib/site";

/** Council voice statistics: counts only. Reading the messages themselves is not part of this page. */
export default async function VoiceStatsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ range?: string }> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const range = parseRange(sp.range);
  const [t, tv, f] = await Promise.all([getTranslations("stats"), getTranslations("voice"), getFormatter()]);
  const data = await voiceReport(range).catch((e: Error) => (console.error("[admin] voice", e.message), null));
  const fmt = (n: number) => f.number(n);
  const day = dayLabel(locale);
  const gradeName = (g: number) => tv("gradeLabel", { g });
  const topicName = (k: string) => (k in VOICE_CATEGORIES ? tv(`categories.${VOICE_CATEGORIES[k as keyof typeof VOICE_CATEGORIES]}`) : k);

  const graded = data ? data.grades.reduce((a, g) => a + g.n, 0) : 0;
  const ranking = data ? [...data.grades].sort((a, b) => b.n - a.n || a.grade - b.grade) : [];
  // highlight a single clear leader only (a tie has no "most")
  const leader = ranking[0]?.n && ranking[1]?.n !== ranking[0].n ? ranking[0] : null;
  const total = data ? t("voice.total", { n: data.total }) : "";

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("nav.voice")} lead={t("voice.lead")}>
        <RangeFilter pathname="/admin/voice" value={range} label={t("range.label")} days={(n) => t("range.days", { n })} />
      </PageHeader>
      {!data ? (
        <ErrorNote text={t("error")} />
      ) : (
        <>
          {leader && (
            <p className="flex items-center gap-3 rounded-[20px] border border-pink/30 bg-pink-soft px-5 py-4 font-display text-lg font-semibold text-strong">
              <Trophy size={24} weight="fill" className="shrink-0 text-pink-ink" aria-hidden />
              {t("voice.top", { grade: gradeName(leader.grade), n: leader.n })}
            </p>
          )}

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3" title={t("voice.byGrade")} aside={total}>
              {graded ? (
                <StatChart
                  type="bar"
                  labels={data.grades.map((g) => gradeName(g.grade))}
                  series={[{ label: t("voice.count"), data: data.grades.map((g) => g.n) }]}
                  highlight={leader ? data.grades.findIndex((g) => g.grade === leader.grade) : undefined}
                  summary={`${t("voice.byGrade")}: ${data.grades.map((g) => `${gradeName(g.grade)} ${g.n}`).join(", ")}`}
                  loading={t("loading")}
                />
              ) : (
                <Empty text={t("empty")} />
              )}
              {data.noGrade > 0 && <p className="mt-3 text-xs text-muted">{t("voice.noGrade")}: {fmt(data.noGrade)}</p>}
            </Card>

            <Card className="lg:col-span-2" title={t("voice.ranking")}>
              {graded ? (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th scope="col" className="pb-2 font-medium">{t("voice.rank")}</th>
                      <th scope="col" className="pb-2 font-medium">{t("voice.grade")}</th>
                      <th scope="col" className="pb-2 text-right font-medium">{t("voice.count")}</th>
                      <th scope="col" className="pb-2 text-right font-medium">{t("voice.share")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((g, i) => (
                      <tr key={g.grade} className={g.grade === leader?.grade ? "bg-pink-soft/60 font-semibold" : undefined}>
                        <td className="border-t border-line py-2 pl-1 tabular-nums text-muted">{i + 1}</td>
                        <td className="border-t border-line py-2">{gradeName(g.grade)}</td>
                        <td className="border-t border-line py-2 text-right tabular-nums">{fmt(g.n)}</td>
                        <td className="border-t border-line py-2 pr-1 text-right tabular-nums">{Math.round((g.n / graded) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <Empty text={t("empty")} />
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3" title={t("voice.trend", { n: range })}>
              {data.total ? (
                <StatChart
                  type="line"
                  labels={data.series.map((s) => day(s.day))}
                  series={[{ label: t("voice.count"), data: data.series.map((s) => s.n) }]}
                  summary={`${t("voice.trend", { n: range })}: ${total}`}
                  loading={t("loading")}
                  height={220}
                />
              ) : (
                <Empty text={t("empty")} />
              )}
            </Card>
            <Card className="lg:col-span-2" title={t("voice.byTopic")}>
              <BarList items={data.categories.map((c) => ({ label: topicName(c.key), n: c.n }))} empty={t("empty")} fmt={fmt} />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
