import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { Petals } from "@/components/ui/Petals";
import { Link } from "@/i18n/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations();
  return (
    <main className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-gradient-to-br from-brand-deep via-brand to-brand-mid px-4 py-10 text-on-brand">
      <Petals />
      <div className="absolute right-4 top-4"><LocaleSwitch /></div>
      <div className="relative w-full max-w-md space-y-6 rounded-[24px] border border-white/15 bg-surface p-8 text-ink shadow-soft">
        <Link href="/" className="flex items-center gap-3" aria-label={t("auth.back")}>
          <picture className="shrink-0">
            <source type="image/avif" srcSet="/brand/logo-council-128.avif 128w, /brand/logo-council-176.avif 176w" sizes="44px" />
            <img src="/brand/logo-council-128.png" srcSet="/brand/logo-council-128.webp 128w, /brand/logo-council-176.webp 176w" sizes="44px" alt={t("header.councilLogoAlt")} width={44} height={44} className="no-select h-11 w-11 object-contain" />
          </picture>
          <span className="font-display text-lg font-semibold text-strong">{t("site.name")}</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
