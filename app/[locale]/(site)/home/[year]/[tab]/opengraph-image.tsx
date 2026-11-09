import { getTranslations } from "next-intl/server";
import { isTab } from "@/lib/search";
import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

// share image of a home tab view (?tab=policy …): the tab's own title
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "สภานักเรียนโรงเรียนอุตรดิตถ์ · Uttaradit School Student Council (UTDSC)";

export default async function Image({ params }: { params: Promise<{ locale: string; tab: string }> }) {
  const { locale, tab } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const title = isTab(tab) ? t(`tabs.${tab}.title`).split(" – ")[0] : t("orgName");
  return ogImage({ kicker: t("orgName"), title, footer: t("ogTagline") });
}
