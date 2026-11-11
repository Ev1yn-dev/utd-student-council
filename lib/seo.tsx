// Search metadata and structured data for the public pages — the ONE place that builds canonical / hreflang URLs,
// Open Graph / Twitter tags and schema.org JSON-LD. Facts only from lib/school-info.ts and lib/contact.ts.
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { CHANNELS } from "@/lib/contact";
import { schoolJsonLd } from "@/lib/school-info";
import { SITE_URL } from "@/lib/site";

export const SITE_SHORT = "UTDSC";
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

const ORG_ID = `${SITE_URL}/#organization`;
const SCHOOL_ID = `${SITE_URL}/#school`;
const SITE_ID = `${SITE_URL}/#website`;

/** Shortens to `max` characters at a word boundary (Thai has no spaces: then at the limit), with an ellipsis. */
export function clip(text: string, max: number) {
  const s = text.replace(/\s+/g, " ").trim();
  if ([...s].length <= max) return s;
  const cut = [...s].slice(0, max - 1).join("");
  const space = cut.lastIndexOf(" ");
  return `${space > max * 0.6 ? cut.slice(0, space) : cut}…`;
}

/** "/th/voice" style path for a locale; `path` is "" for the home page, otherwise starts with "/" (may hold "?tab="). */
export const localePath = (locale: string, path: string) => `/${locale}${path}`;
export const absolute = (p: string) => `${SITE_URL}${p}`;

/** canonical + hreflang (th, en, x-default = th) for one page. */
export function alternates(locale: string, path: string): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: { ...Object.fromEntries(routing.locales.map((l) => [l, localePath(l, path)])), "x-default": localePath("th", path) },
  };
}

/**
 * Metadata for a public page: title (with the "| UTDSC" template unless `absoluteTitle`), description, canonical,
 * hreflang, Open Graph and Twitter. og:image comes from the page's opengraph-image file.
 */
export function pageMetadata(o: { locale: string; path: string; title: string; description: string; siteName: string; absoluteTitle?: boolean; type?: "website" | "article"; published?: string; modified?: string }): Metadata {
  const title = o.absoluteTitle ? clip(o.title, TITLE_MAX) : clip(o.title, TITLE_MAX - ` | ${SITE_SHORT}`.length);
  const full = o.absoluteTitle ? title : `${title} | ${SITE_SHORT}`;
  const description = clip(o.description, DESCRIPTION_MAX);
  const url = absolute(localePath(o.locale, o.path));
  return {
    title: o.absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternates(o.locale, o.path),
    openGraph: {
      type: o.type ?? "website",
      url,
      siteName: o.siteName,
      locale: o.locale === "th" ? "th_TH" : "en_US",
      alternateLocale: o.locale === "th" ? ["en_US"] : ["th_TH"],
      title: full,
      description,
      ...(o.type === "article" ? { publishedTime: o.published, modifiedTime: o.modified } : {}),
    },
    twitter: { card: "summary_large_image", title: full, description },
    robots: { index: true, follow: true },
  };
}

// ───────────────────────── JSON-LD ─────────────────────────

/** The council (Organization) with the school as its parent (EducationalOrganization). */
export function organizationLd(names: { th: string; en: string }) {
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: names.th,
    alternateName: [SITE_SHORT, names.en],
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: absolute("/brand/favicon-512.png"), width: 512, height: 512 },
    sameAs: CHANNELS.filter((c) => c.official).map((c) => c.href),
    parentOrganization: { ...schoolJsonLd(SITE_URL), "@context": undefined, "@id": SCHOOL_ID },
  };
}

export function websiteLd(locale: string, name: string) {
  return { "@type": "WebSite", "@id": SITE_ID, url: SITE_URL, name, alternateName: SITE_SHORT, inLanguage: locale, publisher: { "@id": ORG_ID } };
}

/** BreadcrumbList; items are [name, path without locale], the first one is the home page. */
export function breadcrumbLd(locale: string, items: [string, string][]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absolute(localePath(locale, path)) })),
  };
}

export function articleLd(o: { locale: string; path: string; headline: string; description: string; image: string; published: string; modified: string }) {
  const url = absolute(localePath(o.locale, o.path));
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    mainEntityOfPage: url,
    headline: clip(o.headline, 110),
    description: clip(o.description, DESCRIPTION_MAX),
    image: [o.image],
    datePublished: o.published,
    dateModified: o.modified,
    inLanguage: o.locale,
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
  };
}

/** One <script type="application/ld+json"> with an @graph; "<" escaped so content can never close the tag. */
export function JsonLd({ graph }: { graph: object[] }) {
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
