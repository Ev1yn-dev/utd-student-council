import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroRow } from "@/components/admin/HeroRow";
import { approvedPhotos } from "@/lib/admin/data";
import { requirePermission } from "@/lib/auth";

export default async function HeroPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  await requirePermission("banners.edit");
  const t = await getTranslations("dashboard.hero");
  const photos = await approvedPhotos();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="sr-only">{t("heading")}</h1>
        <p className="text-sm text-muted">{t("sub")}</p>
      </header>
      {photos.length === 0 ? (
        <p className="rounded-[20px] border border-dashed border-line bg-surface p-8 text-center text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((p) => <HeroRow key={p.id} photo={p} />)}
        </ul>
      )}
    </div>
  );
}
