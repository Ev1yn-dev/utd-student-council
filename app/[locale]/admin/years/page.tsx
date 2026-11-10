import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddYearForm, SetCurrentButton } from "@/components/admin/YearControls";
import { getYears } from "@/lib/content";
import { requirePermission } from "@/lib/auth";
import { ceYear } from "@/lib/utils";

export default async function YearsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  await requirePermission("years.manage");
  const t = await getTranslations("dashboard");
  const ty = await getTranslations("year");
  const { years, current } = await getYears();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="sr-only">{t("years.heading")}</h1>
        <p className="text-sm text-muted">{t("years.sub")}</p>
      </header>
      <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft">
        {years.map((y) => (
          <li key={y} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="font-display text-lg font-semibold text-strong">{ty("option", { be: y, ce: ceYear(y) })}</span>
            {y === current ? (
              <span className="rounded-full bg-done/12 px-3 py-1 text-xs font-semibold text-done">{t("years.current")}</span>
            ) : (
              <SetCurrentButton year={y} />
            )}
          </li>
        ))}
      </ul>
      <AddYearForm years={years} suggested={Math.max(...years) + 1} />
    </div>
  );
}
