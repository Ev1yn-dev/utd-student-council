import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { VoiceView } from "@/components/sections/VoiceView";
import { JsonLd, breadcrumbLd, pageMetadata } from "@/lib/seo";

export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "/voice", siteName: t("orgName"), title: t("voiceTitle"), description: t("voiceDescription") });
}

export default async function VoicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "meta" });
  return (
    <>
      <JsonLd graph={[breadcrumbLd(locale, [[t("home"), ""], [t("voiceTitle").split(" – ")[0], "/voice"]])]} />
      <VoiceView />
    </>
  );
}
