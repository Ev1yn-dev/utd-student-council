import { getTranslations } from "next-intl/server";
import { OG_SIZE, OG_TYPE, ogImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const alt = "ส่งเสียงถึงสภา · Voice to the Council — UTDSC";

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "meta" });
  return ogImage({ kicker: t("orgName"), title: t("voiceTitle").split(" – ")[0], footer: t("voiceDescription").split(/[:.]/)[0] });
}
