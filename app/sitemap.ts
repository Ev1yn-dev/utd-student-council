import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getContentUpdatedAt, getPolicyDates } from "@/lib/content";
import { TAB_KEYS } from "@/lib/search";
import { SITE_URL } from "@/lib/site";
import { homePath } from "./[locale]/(site)/home-meta";

// Revalidated with the pages (10 min) so new policies and dates show up without a deploy.
export const revalidate = 600;

/**
 * Every indexable page in both languages, each entry with its hreflang alternates (th, en, x-default = th):
 * the home page, its tab views (?tab=…, each its own canonical page), /voice and every policy. lastModified comes
 * from the content rows (updated_at); pages without a content date (the voice form) have none.
 * Nothing noindexed is listed (sign-in, back office, API, 404).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [contentAt, policies] = await Promise.all([getContentUpdatedAt(), getPolicyDates()]);
  const pages: { path: string; lastModified?: string; priority: number }[] = [
    ...TAB_KEYS.map((t) => ({ path: homePath(t), lastModified: contentAt ?? undefined, priority: homePath(t) ? 0.8 : 1 })),
    { path: "/voice", priority: 0.7 },
    ...policies.map((p) => ({ path: `/policies/${encodeURIComponent(p.slug)}`, lastModified: p.updatedAt ?? undefined, priority: 0.6 })),
  ];
  const at = (l: string, p: string) => `${SITE_URL}/${l}${p}`;
  return pages.flatMap(({ path, lastModified, priority }) =>
    routing.locales.map((l) => ({
      url: at(l, path),
      ...(lastModified ? { lastModified } : {}),
      priority,
      alternates: { languages: { ...Object.fromEntries(routing.locales.map((x) => [x, at(x, path)])), "x-default": at("th", path) } },
    })),
  );
}
