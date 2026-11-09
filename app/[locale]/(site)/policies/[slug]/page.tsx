import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PolicyView } from "@/components/policy/PolicyView";
import { getPolicyBySlug, getYears } from "@/lib/content";
import { JsonLd, absolute, articleLd, breadcrumbLd, pageMetadata } from "@/lib/seo";

// static + ISR (10 min); unknown slugs are rendered on first request, then cached
export const revalidate = 600;
export const generateStaticParams = () => [];

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const p = await getPolicyBySlug(slug);
  if (!p) return { title: t("policyNotFound") };
  const en = locale === "en";
  const title = (en && p.title.en) || p.title.th;
  return pageMetadata({
    locale,
    path: `/policies/${slug}`,
    siteName: t("orgName"),
    title: `${title} – ${t("policySuffix")}`.length <= 50 ? `${title} – ${t("policySuffix")}` : title,
    description: (en && p.summary.en) || p.summary.th || `${title} – ${t("policySuffix")} ${t("orgName")}`,
    type: "article",
    published: p.createdAt ?? undefined,
    modified: p.updatedAt ?? undefined,
  });
}

/** Full policy page (opened from tab ②). Both languages are sent so the language switch works in place. */
export default async function PolicyPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [p, { current }, t] = await Promise.all([getPolicyBySlug(slug), getYears(), getTranslations({ locale, namespace: "meta" })]);
  if (!p) notFound();
  const en = locale === "en";
  const title = (en && p.title.en) || p.title.th;
  const path = `/policies/${slug}`;
  const graph: object[] = [breadcrumbLd(locale, [[t("home"), ""], [t("policies"), "?tab=policy"], [title, path]])];
  // Article needs real dates: only rows from the database have them (the local seed data does not)
  if (p.createdAt) {
    graph.push(articleLd({
      locale,
      path,
      headline: title,
      description: (en && p.summary.en) || p.summary.th || title,
      // the policy's own cover (already public on the page), else the council emblem
      image: p.cover ? (p.cover.src[1920].startsWith("/") ? absolute(p.cover.src[1920]) : p.cover.src[1920]) : absolute("/brand/icon-512.png"),
      published: p.createdAt,
      modified: p.updatedAt ?? p.createdAt,
    }));
  }
  return (
    <>
      <JsonLd graph={graph} />
      <PolicyView p={p} currentYear={current} />
    </>
  );
}
