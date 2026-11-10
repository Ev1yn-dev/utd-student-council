import { CalendarPlus, Download, GalleryHorizontal, Inbox, Megaphone, MessageSquareWarning, type LucideIcon } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ICON } from "@/components/admin/icon";
import { NAV_ICONS } from "@/components/admin/shell/nav";
import { Card, ErrorNote, Skeleton, StatCard, delta } from "@/components/admin/stats/ui";
import { Link } from "@/i18n/navigation";
import { counts, yearParam } from "@/lib/admin/data";
import { ENTITY_KEYS } from "@/lib/admin/entities";
import type { Permission } from "@/lib/admin/permissions";
import { overview } from "@/lib/admin/stats";
import { hasPermission, requirePermission, type AdminSession } from "@/lib/auth";
import { adminClient } from "@/lib/supabase/admin";
import { ceYear } from "@/lib/utils";
import { unreadCount } from "@/lib/voice-admin";

type SP = { year?: string; denied?: string };

async function Kpis({ locale }: { locale: string }) {
  const [t, f] = await Promise.all([getTranslations("stats"), getFormatter({ locale })]);
  const to = (k: string, v?: Record<string, number>) => t(`overview.${k}`, v);
  const d = await overview().catch((e: Error) => (console.error("[admin] overview", e.message), null));
  if (!d) return <ErrorNote text={t("error")} />;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <li><StatCard icon="visits" href="/admin/visits?range=7" label={to("today")} value={f.number(d.today.now)} change={delta(d.today.now, d.today.prev, to)} compare={to("vsYesterday")} spark={d.today.spark} /></li>
      <li><StatCard icon="visits" href="/admin/visits?range=7" label={to("views7")} value={f.number(d.views7.now)} change={delta(d.views7.now, d.views7.prev, to)} compare={to("vsPrev")} spark={d.views7.spark} /></li>
      <li><StatCard icon="uniques" href="/admin/visits?range=7" label={to("uniques7")} value={f.number(d.uniques7.now)} change={delta(d.uniques7.now, d.uniques7.prev, to)} compare={to("vsPrev")} spark={d.uniques7.spark} /></li>
      <li><StatCard icon="voice" href="/admin/voice?range=7" label={to("voice7")} value={f.number(d.voice7.now)} change={delta(d.voice7.now, d.voice7.prev, to)} compare={to("vsPrev")} spark={d.voice7.spark} tone="var(--c-chart-2)" /></li>
    </ul>
  );
}

async function InboxCard() {
  const t = await getTranslations("admin.overview");
  const [unread, flagged] = await Promise.all([
    unreadCount().catch(() => 0),
    adminClient().from("voice_messages").select("id", { count: "exact", head: true }).eq("flagged", true).is("read_at", null).then((r) => r.count ?? 0, () => 0),
  ]);
  return (
    <Card title={t("inbox")}>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/messages?unread=1" className="rounded-xl bg-surface-2 p-4 transition-colors hover:bg-sky">
          <p className="flex items-center gap-2 text-sm text-muted"><Inbox {...ICON} />{t("unread")}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-strong">{unread}</p>
        </Link>
        <Link href="/admin/messages?flagged=1&unread=1" className="rounded-xl bg-surface-2 p-4 transition-colors hover:bg-sky">
          <p className="flex items-center gap-2 text-sm text-muted"><MessageSquareWarning {...ICON} />{t("flagged")}</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-strong">{flagged}</p>
        </Link>
      </div>
    </Card>
  );
}

async function ContentCounts({ year }: { year: number }) {
  const [t, td] = await Promise.all([getTranslations("admin.overview"), getTranslations("dashboard")]);
  const c = await counts(year);
  return (
    <section id="content" aria-labelledby="content-h" className="scroll-mt-24">
      <h2 id="content-h" className="mb-3 font-display text-base font-semibold text-strong">{t("content", { be: year, ce: ceYear(year) })}</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {ENTITY_KEYS.map((k) => {
          const Icon = NAV_ICONS[k];
          return (
            <li key={k}>
              <Link href={{ pathname: `/admin/content/${k}`, query: { year: String(year) } }} className="block h-full rounded-[20px] border border-line bg-surface p-4 shadow-soft transition duration-150 hover:-translate-y-0.5 hover:shadow-lift motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <p className="flex items-center gap-2 text-sm text-muted"><Icon {...ICON} />{td(`entities.${k}`)}</p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-strong">{c[k].published}</p>
                <p className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{t("published")}</span>
                  {c[k].pending > 0 && <span className="rounded-full bg-progress/15 px-2 py-0.5 font-medium text-progress">{t("pending", { n: c[k].pending })}</span>}
                  {c[k].total - c[k].published - c[k].pending > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">{t("other", { n: c[k].total - c[k].published - c[k].pending })}</span>}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const QUICK: { perm: Permission; href: string; key: string; icon: LucideIcon }[] = [
  { perm: "content.edit", href: "/admin/content/announcements/new", key: "newAnnouncement", icon: Megaphone },
  { perm: "content.edit", href: "/admin/content/activities/new", key: "newActivity", icon: CalendarPlus },
  { perm: "messages.read", href: "/admin/messages?unread=1", key: "readMessages", icon: Inbox },
  { perm: "banners.edit", href: "/admin/banners", key: "banners", icon: GalleryHorizontal },
  { perm: "data.export", href: "/admin/data", key: "export", icon: Download },
];

async function QuickActions({ s, year }: { s: AdminSession; year: number }) {
  const t = await getTranslations("admin.overview");
  const list = QUICK.filter((q) => hasPermission(s, q.perm));
  if (!list.length) return null;
  return (
    <Card title={t("quick")}>
      <ul className="flex flex-wrap gap-2">
        {list.map((q) => (
          <li key={q.key}>
            <Link
              href={{ pathname: q.href.split("?")[0], query: { ...Object.fromEntries(new URLSearchParams(q.href.split("?")[1] ?? "")), ...(q.perm === "content.edit" ? { year: String(year) } : {}) } }}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors duration-150 hover:border-pink hover:text-pink-ink"
            >
              <q.icon {...ICON} />{t(`actions.${q.key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Back-office home: one page for the statistics, the inbox and the content of the year picked in the top bar. */
export default async function AdminOverview({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const s = await requirePermission("stats.view");
  const [t, { year }] = await Promise.all([getTranslations("admin.overview"), yearParam(sp.year, s.prefYear)]);

  return (
    <div className="max-w-7xl space-y-6">
      <p className="text-sm text-muted">{t("lead")}</p>
      {sp.denied && <p role="alert" className="rounded-xl border border-danger/30 bg-pink-soft px-4 py-3 text-sm text-danger">{t("denied")}</p>}
      <Suspense fallback={<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}</div>}>
        <Kpis locale={locale} />
      </Suspense>
      <div className="grid gap-4 lg:grid-cols-2">
        {hasPermission(s, "messages.read") && <Suspense fallback={<Skeleton className="h-40" />}><InboxCard /></Suspense>}
        <QuickActions s={s} year={year} />
      </div>
      {hasPermission(s, "content.edit") && (
        <Suspense fallback={<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{ENTITY_KEYS.map((k) => <Skeleton key={k} className="h-32" />)}</div>}>
          <ContentCounts year={year} />
        </Suspense>
      )}
    </div>
  );
}
