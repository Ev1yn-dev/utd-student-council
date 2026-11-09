import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

// Any unknown path under a locale renders app/[locale]/not-found.tsx (status 404, noindex).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "notFound" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default function CatchAll() {
  notFound();
}
