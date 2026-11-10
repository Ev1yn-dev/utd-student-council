import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { RosterImport } from "@/components/admin/RosterImport";
import { Card, ErrorNote, PageHeader } from "@/components/admin/stats/ui";
import { requirePermission } from "@/lib/auth";
import { currentAcademicYear, rosterSummary } from "@/lib/roster";

/** Admin only: student roster for the voice form. Counts per grade, never a list of IDs. */
export default async function RosterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requirePermission("roster.import");
  const [t, tv, f] = await Promise.all([getTranslations("roster"), getTranslations("voice"), getFormatter()]);
  const sum = await rosterSummary().catch((e: Error) => (console.error("[admin] roster", e.message), null));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title={t("nav")} lead={t("lead")} />
      {!sum ? (
        <ErrorNote text={t("errors.failed")} />
      ) : (
        <Card title={t("summary")} aside={sum.updatedAt ? t("updated", { when: f.dateTime(new Date(sum.updatedAt), { dateStyle: "medium", timeStyle: "short" }) }) : undefined}>
          {sum.total ? (
            <>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {sum.grades.map((g) => (
                  <li key={g.grade} className="rounded-xl bg-surface-2 px-3 py-2 text-center">
                    <span className="block text-xl font-semibold tabular-nums text-strong">{f.number(g.n)}</span>
                    <span className="text-sm text-muted">{tv("gradeLabel", { g: g.grade })}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">
                {t("total", { n: f.number(sum.total) })}
                {sum.year ? ` · ${t("yearShown", { year: String(sum.year) })}` : ""}
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm text-ink">{t("empty")}</p>
          )}
        </Card>
      )}
      <Card title={t("importTitle")}>
        <RosterImport year={sum?.year ?? currentAcademicYear()} />
      </Card>
    </div>
  );
}
