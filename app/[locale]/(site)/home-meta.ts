import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DEFAULT_TAB, isTab } from "@/lib/search";
import { pageMetadata } from "@/lib/seo";

/** Path of a home view: "" for the default tab, "?tab=policy" etc. for the others (each has its own content). */
export const homePath = (tab?: string) => (isTab(tab) && tab !== DEFAULT_TAB ? `?tab=${tab}` : "");

/** Home page and its tab views (?tab=…); ?year= views of past years share the current year's canonical. */
export async function homeMetadata(locale: string, tab?: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "meta" });
  const path = homePath(tab);
  const siteName = t("orgName");
  if (!path) return pageMetadata({ locale, path, siteName, title: t("homeTitle"), description: t("homeDescription"), absoluteTitle: true });
  return pageMetadata({ locale, path, siteName, title: t(`tabs.${tab}.title`), description: t(`tabs.${tab}.description`) });
}
