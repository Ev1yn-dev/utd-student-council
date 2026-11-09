import { getTranslations } from "next-intl/server";
import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

// share image of the home page and its tab views (text + emblem only; see lib/og.tsx)
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "สภานักเรียนโรงเรียนอุตรดิตถ์ · Uttaradit School Student Council (UTDSC)";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "meta" });
  return ogImage({ kicker: "UTDSC", title: t("orgName"), footer: t("ogTagline") });
}
