import type { Metadata, Viewport } from "next";
import { BrowserCheck } from "@/components/layout/BrowserCheck";
import { DECOY_TEXT } from "@/lib/decoy-text";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans_Thai, Kanit, Noto_Serif_Thai } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import en from "@/messages/en.json";
import th from "@/messages/th.json";

// One font set for both languages (see NOTES.md): Kanit and IBM Plex Sans Thai include matching Latin glyphs,
// so switching language never swaps fonts or shifts layout.
const kanit = Kanit({ variable: "--font-kanit", subsets: ["thai", "latin"], weight: ["500", "600", "700"], display: "swap" });
const plex = IBM_Plex_Sans_Thai({ variable: "--font-plex", subsets: ["thai", "latin"], weight: ["400", "500"], display: "swap" });
const notoSerif = Noto_Serif_Thai({ variable: "--font-noto-serif", subsets: ["thai", "latin"], weight: ["400", "500", "700"], display: "swap" });


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    alternates: { canonical: `/${locale}`, languages: { th: "/th", en: "/en", "x-default": "/th" } },
    openGraph: { type: "website", url: `${SITE_URL}/${locale}`, locale: locale === "th" ? "th_TH" : "en_US", siteName: t("title"), title: t("title"), description: t("description") },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: "#0b1f4d", colorScheme: "light" };

// Public pages are static (ISR); sign-in / back office pages become dynamic by reading the session.
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} className={`${kanit.variable} ${plex.variable} ${notoSerif.variable}`} suppressHydrationWarning>
      <head>
        {/* the anti-code-fetching note (lib/browser-gate.ts) as an HTML comment at the top of every page */}
        <noscript dangerouslySetInnerHTML={{ __html: `<!-- ${DECOY_TEXT} -->` }} />
      </head>
      <body className="min-h-dvh">
        <LocaleProvider initial={locale} messages={{ th, en }}>{children}</LocaleProvider>
        <BrowserCheck />
      </body>
    </html>
  );
}
