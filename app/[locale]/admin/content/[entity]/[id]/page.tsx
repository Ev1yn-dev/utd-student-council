import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { EntityForm } from "@/components/admin/EntityForm";
import { Link } from "@/i18n/navigation";
import { getRowForForm, yearParam } from "@/lib/admin/data";
import { ENTITIES, isEntity } from "@/lib/admin/entities";
import { requirePermission } from "@/lib/auth";

type Props = { params: Promise<{ locale: string; entity: string; id: string }>; searchParams: Promise<{ year?: string; from?: string; n?: string }> };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** New (`/new`, optionally `?from=<id>` to duplicate) or edit form for one item. */
export default async function EntityEdit({ params, searchParams }: Props) {
  const [{ locale, entity, id }, sp] = await Promise.all([params, searchParams]);
  if (!isEntity(entity) || (id !== "new" && !UUID.test(id))) notFound();
  setRequestLocale(locale);
  const s = await requirePermission("content.edit");
  const t = await getTranslations("dashboard");
  const loaded = id === "new" ? null : await getRowForForm(entity, id);
  if (id !== "new" && !loaded) notFound();

  // duplicate: copy the text fields of another row (no photos, no review state; slug gets -copy)
  let row: Record<string, unknown> = loaded?.row ?? {};
  if (id === "new" && sp.from && UUID.test(sp.from)) {
    const src = await getRowForForm(entity, sp.from);
    if (src) {
      const e = ENTITIES[entity];
      row = Object.fromEntries(e.fields.filter((f) => f.kind !== "image" && f.kind !== "images").flatMap((f) => [[f.name, src.row[f.name]], [`${f.name}_en`, src.row[`${f.name}_en`]]]));
      row[e.titleCol] = `${String(src.row[e.titleCol] ?? "")}${t("form.copySuffix")}`;
      if ("slug" in row && row.slug) row.slug = `${String(row.slug).slice(0, 70)}-copy`; // a clash is reported on save (slugTaken)
    }
  }
  const { year: picked } = await yearParam(sp.year, s.prefYear);
  const year = loaded ? Number(loaded.row.year) : picked;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href={{ pathname: `/admin/content/${entity}`, query: { year: String(year) } }} className="text-sm text-muted hover:text-pink-ink">← {t("form.back")}</Link>
      <h1 className="sr-only">{t(id === "new" ? "form.newTitle" : "form.editTitle", { entity: t(`entities.${entity}`) })}</h1>
            <EntityForm
        key={`${id}:${sp.n ?? ""}:${sp.from ?? ""}`}
        entity={entity}
        id={id === "new" ? null : id}
        year={year}
        locale={locale}
        staff
        row={row}
        media={loaded?.media ?? {}}
      />
    </div>
  );
}
