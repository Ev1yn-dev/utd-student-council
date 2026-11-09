import type { Metadata } from "next";
import { homeMetadata } from "../../../home-meta";
import { HomeView } from "../../../home-view";

// /th?year=2568&tab=policy is served from here (rewrite in proxy.ts); each combination is rendered once and cached.
export const revalidate = 600;
export const generateStaticParams = () => [];

type Props = { params: Promise<{ locale: string; year: string; tab: string }> };

/** Each tab is its own page for search (only the open tab's content is in the HTML): canonical /th?tab=policy etc.
 *  The year is left out, so past-year views point at the current one. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tab } = await params;
  return homeMetadata(locale, tab);
}

export default async function HomeVariant({ params }: Props) {
  const { locale, year, tab } = await params;
  return <HomeView locale={locale} year={/^\d{4}$/.test(year) ? Number(year) : undefined} tab={tab} />;
}
