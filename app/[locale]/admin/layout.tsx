import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminNav, type NavItem } from "@/components/admin/AdminNav";
import { Toaster } from "@/components/admin/Toaster";
import { requireRole } from "@/lib/auth";
import { unreadCount } from "@/lib/voice-admin";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "dashboard" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

/** Admin shell (admins only): statistics first, then the admin tools. Every page re-checks the role as well. */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await requireRole(["admin"]);
  const [t, td, ts, tu, tsec, tr, ti, unread] = await Promise.all([
    getTranslations("stats"), getTranslations("dashboard"), getTranslations("setup"), getTranslations("users"), getTranslations("security"), getTranslations("roster"),
    getTranslations("inbox"), unreadCount().catch(() => 0),
  ]);
  const primary: NavItem[] = [
    { href: "/admin", label: t("nav.overview"), icon: "overview" },
    { href: "/admin/visits", label: t("nav.visits"), icon: "visits" },
    { href: "/admin/voice", label: t("nav.voice"), icon: "voice" },
    { href: "/admin/messages", label: ti("nav"), icon: "messages", badge: unread },
  ];
  const secondary: NavItem[] = [
    { href: "/dashboard", label: t("nav.content"), icon: "content" },
    { href: "/admin/roster", label: tr("nav"), icon: "roster" },
    { href: "/admin/users", label: tu("nav"), icon: "users" },
    { href: "/admin/setup", label: ts("nav"), icon: "setup" },
    { href: "/admin/security", label: tsec("nav"), icon: "security" },
    { href: "/", label: td("nav.viewSite"), icon: "site" },
  ];

  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[248px_1fr]">
      <AdminNav
        primary={primary}
        secondary={secondary}
        email={s.email}
        role={td(`roles.${s.role}`)}
        newLabel={ti("new")}
        labels={{ nav: t("nav.label"), manage: t("nav.manage"), more: t("nav.more"), close: t("nav.close"), signOut: td("nav.signOut"), signedInAs: td("nav.signedInAs"), title: td("title") }}
      />
      <main className="min-w-0 px-4 pb-28 pt-5 md:px-8 lg:py-8">{children}</main>
      <Toaster />
    </div>
  );
}
