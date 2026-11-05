import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashNav } from "@/components/admin/DashNav";
import { Toaster } from "@/components/admin/Toaster";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { Link } from "@/i18n/navigation";
import { ENTITY_KEYS } from "@/lib/admin/entities";
import { MEMBERS, STAFF, requireRole } from "@/lib/auth";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "dashboard" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Back office shell. Every page and action re-checks the role; this only decides what the menu shows. */
export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await requireRole(MEMBERS);
  const t = await getTranslations("dashboard");
  const ts = await getTranslations("setup");
  const tu = await getTranslations("users");
  const tsec = await getTranslations("security");
  const tst = await getTranslations("stats");
  const items = [
    { href: "/dashboard", label: t("nav.overview") },
    ...ENTITY_KEYS.map((k) => ({ href: `/dashboard/${k}`, label: t(`entities.${k}`) })),
    ...(STAFF.includes(s.role) ? [{ href: "/dashboard/hero", label: t("nav.hero") }] : []),
    ...(s.role === "admin" ? [{ href: "/admin", label: tst("title") }, { href: "/dashboard/years", label: t("nav.years") }, { href: "/dashboard/consent", label: t("consent.nav") }, { href: "/admin/users", label: tu("nav") }, { href: "/admin/setup", label: ts("nav") }, { href: "/admin/security", label: tsec("nav") }] : []),
  ];

  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="bg-gradient-to-b from-brand-deep to-[#0b1f4d] text-on-brand lg:sticky lg:top-0 lg:h-dvh">
        <div className="flex items-center justify-between gap-3 px-5 py-4 lg:block lg:space-y-4 lg:py-6">
          <Link href="/" className="block font-display text-lg font-semibold leading-tight">
            {t("title")}
            <span className="block text-xs font-normal text-on-brand/60">{t("nav.viewSite")} ↗</span>
          </Link>
          <LocaleSwitch />
        </div>
        <DashNav items={items} label={t("nav.label")} />
        <div className="hidden space-y-2 border-t border-white/10 px-5 py-4 text-sm lg:block">
          <p className="text-on-brand/60">{t("nav.signedInAs")}</p>
          <p className="truncate font-medium">{s.email}</p>
          <p className="w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{t(`roles.${s.role}`)}</p>
          <form action="/auth/signout" method="post">
            <button type="submit" className="mt-2 text-on-brand/80 underline-offset-4 hover:text-pink-400 hover:underline">{t("nav.signOut")}</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 px-4 py-6 md:px-8 md:py-8">{children}</main>
      <Toaster />
    </div>
  );
}
