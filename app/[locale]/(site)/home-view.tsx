import { getTranslations, setRequestLocale } from "next-intl/server";
import { HomeTabs } from "@/components/home/HomeTabs";
import { Hero } from "@/components/sections/Hero";
import { getYearContent } from "@/lib/content";
import { DEFAULT_TAB, isTab } from "@/lib/search";
import { JsonLd, breadcrumbLd, organizationLd, websiteLd } from "@/lib/seo";
import { homePath } from "./home-meta";

/**
 * The single public page (banner, year/search/tab bar, tab content). Rendered statically and refreshed every 10 min
 * (ISR); reads no cookies or headers. `?year=` / `?tab=` views are rewritten by proxy.ts to /[locale]/home/[year]/[tab]
 * so each one is its own cached page and opens on the right tab without a flash.
 */
export async function HomeView({ locale, year, tab }: { locale: string; year?: number; tab?: string }) {
  setRequestLocale(locale);
  const [content, th, en, t] = await Promise.all([
    getYearContent(year),
    getTranslations({ locale: "th", namespace: "meta" }),
    getTranslations({ locale: "en", namespace: "meta" }),
    getTranslations({ locale, namespace: "meta" }),
  ]);
  const path = homePath(tab);
  const graph: object[] = [organizationLd({ th: th("orgName"), en: en("orgName") }), websiteLd(locale, t("orgName"))];
  if (path) graph.push(breadcrumbLd(locale, [[t("home"), ""], [t(`tabs.${tab}.title`).split(" – ")[0], path]]));
  return (
    <>
      <JsonLd graph={graph} />
      <Hero />
      <HomeTabs content={content} initialTab={isTab(tab) ? tab : DEFAULT_TAB} />
    </>
  );
}
