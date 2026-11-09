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
import { SITE_SHORT } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";
import en from "@/messages/en.json";
import th from "@/messages/th.json";

// One font set for both languages (see NOTES.md): Kanit and IBM Plex Sans Thai include matching Latin glyphs,
// so switching language never swaps fonts or shifts layout.
// Preload only the Thai files of the two text fonts: the Latin files and the serif still load through @font-face when a
// page uses them (display: swap), but no longer compete with the banner (LCP) for bandwidth on the first view.
const kanit = Kanit({ variable: "--font-kanit", subsets: ["thai"], weight: ["500", "600", "700"], display: "swap" });
const plex = IBM_Plex_Sans_Thai({ variable: "--font-plex", subsets: ["thai"], weight: ["400", "500"], display: "swap" });
const notoSerif = Noto_Serif_Thai({ variable: "--font-noto-serif", subsets: ["thai", "latin"], weight: ["400", "500", "700"], display: "swap", preload: false });


export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  // defaults only: every public page sets its own title, description, canonical, hreflang and Open Graph (lib/seo.tsx);
  // no canonical here, so pages without one (404, sign-in, back office — all noindex) never point at the home page
  return {
    metadataBase: new URL(SITE_URL),
    applicationName: t("homeTitle"),
    title: { default: t("homeTitle"), template: `%s | ${SITE_SHORT}` },
    description: t("homeDescription"),
    formatDetection: { telephone: false, email: false, address: false },
    // Search Console / Bing Webmaster Tools ownership (HTML tag method); read at build time — redeploy after setting
    verification: { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) },
  };
}

// Back-office namespaces stay on the server for public pages (~22 KB per language less in every page's payload);
// app/[locale]/admin and app/[locale]/dashboard add them back with components/i18n/AllMessages.tsx.
const BACK_OFFICE = new Set(["dashboard", "setup", "inbox", "stats", "roster", "security", "users"]);
const publicMessages = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).filter(([k]) => !BACK_OFFICE.has(k)));

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
        <LocaleProvider initial={locale} messages={{ th: publicMessages(th), en: publicMessages(en) }}>{children}</LocaleProvider>
        <BrowserCheck />
      </body>
    </html>
  );
}
