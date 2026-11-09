import { getTranslations } from "next-intl/server";
import { getPolicyBySlug } from "@/lib/content";
import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "นโยบายสภานักเรียน · Student Council Policy — UTDSC";

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const [t, p] = await Promise.all([getTranslations({ locale, namespace: "meta" }), getPolicyBySlug(slug)]);
  const title = p ? (locale === "en" && p.title.en) || p.title.th : t("policyNotFound");
  return ogImage({ kicker: t("orgName"), title, footer: t("policySuffix") });
}
