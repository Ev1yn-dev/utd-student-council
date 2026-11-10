import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ListSearch } from "@/components/admin/ListSearch";
import { ListTable } from "@/components/admin/ListTable";
import { Link } from "@/i18n/navigation";
import { listRows, yearParam } from "@/lib/admin/data";
import { isEntity } from "@/lib/admin/entities";
import { requirePermission } from "@/lib/auth";

type Props = { params: Promise<{ locale: string; entity: string }>; searchParams: Promise<{ year?: string; saved?: string; q?: string; page?: string }> };

export default async function EntityList({ params, searchParams }: Props) {
  const [{ locale, entity }, sp] = await Promise.all([params, searchParams]);
  if (!isEntity(entity)) notFound();
  setRequestLocale(locale);
  const s = await requirePermission("content.edit");
  const t = await getTranslations("dashboard");
  const { year } = await yearParam(sp.year, s.prefYear);
  const q = sp.q ?? "";
  const { rows, page, pages } = await listRows(entity, year, s.id, { page: Number(sp.page) || 1, q });
  const pageHref = (p: number) => ({ pathname: `/admin/content/${entity}`, query: { year: String(year), ...(q ? { q } : {}), page: String(p) } });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="sr-only">{t(`entities.${entity}`)}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={{ pathname: `/admin/content/${entity}/new`, query: { year: String(year) } }}
            className="rounded-full bg-pink px-5 py-2.5 font-display font-semibold text-white transition hover:-translate-y-0.5 hover:shadow-glow"
          >
            + {t("list.new")}
          </Link>
        </div>
      </header>
      <ListSearch q={q} year={year} />
      {sp.saved && (
        <p role="status" className="rounded-xl border border-done/30 bg-done/10 px-4 py-3 text-sm text-done">{t("list.saved")}</p>
      )}

      {rows.length === 0 && !q ? (
        <>
          <ListTable entity={entity} year={year} staff rows={[]} />
          <p className="rounded-[20px] border border-dashed border-line bg-surface p-8 text-center text-muted">{t("list.empty")}</p>
        </>
      ) : (
        <ListTable
          entity={entity}
          year={year}
          staff
          rows={rows.map((r) => ({
            ...r,
            canEdit: true,
            canDelete: true,
            editHref: `/admin/content/${entity}/${r.id}?year=${year}`,
          }))}
        />
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3 text-sm" aria-label={t("list.page", { page, pages })}>
          {page > 1 && <Link href={pageHref(page - 1)} className="rounded-full border border-line px-4 py-1.5 hover:border-pink">← {t("list.prev")}</Link>}
          <span className="text-muted">{t("list.page", { page, pages })}</span>
          {/* Link prefetches the next page when it scrolls into view */}
          {page < pages && <Link href={pageHref(page + 1)} prefetch className="rounded-full border border-line px-4 py-1.5 hover:border-pink">{t("list.next")} →</Link>}
        </nav>
      )}
    </div>
  );
}
