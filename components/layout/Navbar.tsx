"use client";

import { MessageSquareText } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { Link, usePathname } from "@/i18n/navigation";
import { MobileDock } from "@/components/layout/MobileDock";
import { ChannelLinks } from "@/components/ui/ChannelLinks";
import { cn } from "@/lib/utils";

const LOGO_SIZES = "(min-width: 768px) 54px, (min-width: 640px) 44px, 36px";

/** Emblem in the header: transparent AVIF (WebP / PNG fallback), fixed box so nothing shifts while it loads. */
function Logo({ name, alt, delay, className, lazy }: { name: "school" | "council"; alt: string; delay: number; className?: string; lazy?: boolean }) {
  // CSS pop-in (globals.css .logo-pop): painted with the first frame, no JS needed
  return (
    <span
      style={{ animationDelay: `${delay}s` }}
      className={`logo-pop no-select block h-9 w-9 shrink-0 sm:h-11 sm:w-11 md:h-[54px] md:w-[54px] ${className ?? ""}`}
    >
      <picture>
        <source type="image/avif" srcSet={`/brand/logo-${name}-128.avif 128w, /brand/logo-${name}-256.avif 256w`} sizes={LOGO_SIZES} />
        <img src={`/brand/logo-${name}-128.png`} srcSet={`/brand/logo-${name}-128.webp 128w, /brand/logo-${name}-256.webp 256w`} sizes={LOGO_SIZES} alt={alt} width={54} height={54} loading={lazy ? "lazy" : undefined} className="h-full w-full object-contain" draggable={false} />
      </picture>
    </span>
  );
}


export function Navbar() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const onVoice = pathname === "/voice";
  // the site name is the home page's one <h1> (same look: preflight resets heading styles); other pages have their own
  const Name = pathname === "/" ? "h1" : "span";
  return (
    // no overflow-hidden here: the language menu / phone rail drop below the header; only the glow is clipped
    <header className="relative z-30 bg-gradient-to-r from-brand-deep via-[#0a1a40] to-[#0e2a66] text-on-brand shadow-[0_6px_24px_-8px_rgb(5_13_36/0.6)]">
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden"><span className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-pink/20 blur-3xl" /></span>
      <nav aria-label={t("header.nav")} className="relative mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 py-3 md:py-4">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2.5 md:gap-3"
          aria-label={t("header.home", { name: `${t("site.name")} ${locale === "th" ? t("site.nameEn") : t("site.nameTh")}` })}
        >
          <Logo name="school" alt={t("header.schoolLogoAlt")} delay={0.05} />
          {/* hidden on phones: lazy, so a phone never downloads it */}
          <Logo name="council" alt={t("header.councilLogoAlt")} delay={0.15} className="max-sm:hidden" lazy />
          <span data-swap className="ml-1 min-w-0">
            <Name className="line-clamp-2 block font-display text-[0.85rem] font-semibold leading-tight sm:truncate sm:text-[1.1rem] sm:leading-snug md:text-[1.35rem]">
              {t("site.name")}
            </Name>
            {/* second line = the other language's name */}
            <span lang={locale === "th" ? "en" : "th"} className="hidden truncate text-[0.7rem] tracking-[0.04em] text-on-brand/60 sm:block md:text-sm">
              {locale === "th" ? t("site.nameEn") : t("site.nameTh")}
            </span>
          </span>
        </Link>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            href="/voice"
            aria-current={onVoice ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-3 text-sm font-medium transition duration-300 hover:-translate-y-0.5 hover:border-pink-400/70 hover:shadow-glow",
              onVoice ? "border-pink-400/70 bg-pink-soft text-pink-ink" : "border-white/20 bg-white/5 hover:bg-white/10",
            )}
          >
            <MessageSquareText size={17} strokeWidth={1.75} aria-hidden />
            <span>{t("header.voice")}</span>
          </Link>
          <ChannelLinks />
          <LocaleSwitch />
        </div>
        {/* phones (< md): menu button + vertical contact / language rail */}
        <MobileDock />
      </nav>
    </header>
  );
}
