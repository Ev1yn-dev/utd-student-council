import type { Metadata } from "next";
import { homeMetadata } from "./home-meta";
import { HomeView } from "./home-view";

// static + ISR: content refreshes every 10 minutes (approvals also revalidate it at once)
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return homeMetadata((await params).locale);
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  return <HomeView locale={(await params).locale} />;
}
