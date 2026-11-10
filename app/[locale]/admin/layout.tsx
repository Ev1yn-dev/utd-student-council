import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AllMessages } from "@/components/i18n/AllMessages";
import { Toaster } from "@/components/admin/Toaster";
import { AdminShell } from "@/components/admin/shell/AdminShell";
import type { NavGroup, NavItem } from "@/components/admin/shell/nav";
import type { Notice } from "@/components/admin/shell/TopBar";
import type { Permission } from "@/lib/admin/permissions";
import { ENTITY_KEYS } from "@/lib/admin/entities";
import { hasPermission, requireAdmin } from "@/lib/auth";
import { getYears } from "@/lib/content";
import { adminClient } from "@/lib/supabase/admin";
import { ceYear } from "@/lib/utils";
import { unreadCount } from "@/lib/voice-admin";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: (await params).locale, namespace: "admin" });
  return { title: t("title"), robots: { index: false, follow: false, nocache: true } };
}

/** Rows waiting for publishing, across the content types (one year). */
async function pendingContent(year: number) {
  const db = adminClient();
  const res = await Promise.all(ENTITY_KEYS.map((k) => db.from(k).select("id", { count: "exact", head: true }).eq("year", year).eq("status", "pending")));
  return res.reduce((a, r) => a + (r.count ?? 0), 0);
}
async function recentSecurityEvents() {
  const { count } = await adminClient().from("security_events").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 864e5).toISOString());
  return count ?? 0;
}

/**
 * The one back-office shell. The menu lists only what this account's permissions allow; every page, action and API
 * route still checks its own permission on the server (lib/auth.ts requirePermission / authorizePermission).
 */
export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await requireAdmin();
  const can = (p: Permission) => hasPermission(s, p);
  const { years, current } = await getYears();
  const year = s.prefYear && years.includes(s.prefYear) ? s.prefYear : current;
  const [t, td, ty, unread, pending, events] = await Promise.all([
    getTranslations("admin"), getTranslations("dashboard"), getTranslations("year"),
    can("messages.read") ? unreadCount().catch(() => 0) : 0,
    can("content.edit") ? pendingContent(year).catch(() => 0) : 0,
    can("security.view") ? recentSecurityEvents().catch(() => 0) : 0,
  ]);

  const item = (perm: Permission | Permission[] | null, i: NavItem): NavItem[] =>
    perm === null || (Array.isArray(perm) ? perm.some(can) : can(perm)) ? [i] : [];
  const groups: NavGroup[] = [
    { key: "overview", label: null, items: item("stats.view", { href: "/admin", label: t("nav.overview"), icon: "overview" }) },
    { key: "stats", label: t("nav.stats"), items: [
      ...item("stats.view", { href: "/admin/visits", label: t("nav.visits"), icon: "visits", yearScoped: false }),
      ...item("stats.view", { href: "/admin/voice", label: t("nav.voice"), icon: "voice", yearScoped: false }),
    ] },
    { key: "inbox", label: t("nav.inbox"), items: [
      ...item("messages.read", { href: "/admin/messages", label: t("nav.messages"), icon: "messages", badge: unread, yearScoped: false }),
      ...item("senders.block", { href: "/admin/blocked", label: t("nav.blocked"), icon: "blocked", yearScoped: false }),
    ] },
    { key: "content", label: t("nav.content"), items: [
      ...ENTITY_KEYS.flatMap((k) => item("content.edit", { href: `/admin/content/${k}`, label: td(`entities.${k}`), icon: k })),
      ...item("banners.edit", { href: "/admin/banners", label: t("nav.banners"), icon: "banners", yearScoped: false }),
      ...item("consent.view", { href: "/admin/consent", label: t("nav.consent"), icon: "consent" }),
    ] },
    { key: "system", label: t("nav.system"), items: [
      ...item("years.manage", { href: "/admin/years", label: t("nav.years"), icon: "years", yearScoped: false }),
      ...item("roster.import", { href: "/admin/roster", label: t("nav.roster"), icon: "roster", yearScoped: false }),
      ...item("users.manage", { href: "/admin/users", label: t("nav.users"), icon: "users", yearScoped: false }),
      ...item(["data.export", "data.reset.view"], { href: "/admin/data", label: t("nav.data"), icon: "data" }),
      ...item("settings.edit", { href: "/admin/setup", label: t("nav.setup"), icon: "setup", yearScoped: false }),
      ...item("security.view", { href: "/admin/security", label: t("nav.security"), icon: "security", yearScoped: false }),
      ...item(null, { href: "/", label: t("nav.site"), icon: "site", external: true }),
    ] },
  ].filter((g) => g.items.length > 0);

  const notices: Notice[] = [
    ...(unread ? [{ href: "/admin/messages?unread=1", text: t("top.unread", { n: unread }), n: unread }] : []),
    ...(pending ? [{ href: "/admin?pending=1#content", text: t("top.pending", { n: pending }), n: pending }] : []),
    ...(events ? [{ href: "/admin/security", text: t("top.events", { n: events }), n: events }] : []),
  ];

  return (
    <AllMessages>
      <AdminShell
        groups={groups} years={years} current={current} pref={s.prefYear} notices={notices} email={s.email} role={t(`roles.${s.role}`)}
        canContent={can("content.edit")}
        labels={{
          title: t("title"), nav: t("nav.label"), home: t("top.home"), breadcrumb: t("top.breadcrumb"), menu: t("top.menu"), close: t("top.close"),
          year: ty("label"), yearOptions: Object.fromEntries(years.map((y) => [y, t("top.yearOption", { be: y, ce: ceYear(y) })])),
          search: t("top.search"), searchHint: t("top.searchHint"), searchEmpty: t("top.searchEmpty"), searchPages: t("top.searchPages"), searchContent: t("top.searchContent"),
          notifications: t("top.notifications"), notificationsEmpty: t("top.notificationsEmpty"), account: t("top.account"), signOut: t("top.signOut"),
          site: t("nav.site"), edit: t("top.edit"), create: t("top.create"), newLabel: t("top.new"),
          entities: Object.fromEntries(ENTITY_KEYS.map((k) => [k, td(`entities.${k}`)])),
        }}
      >
        {children}
      </AdminShell>
      <Toaster />
    </AllMessages>
  );
}
