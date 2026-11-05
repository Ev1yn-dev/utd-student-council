"use client";

import {
  Ellipsis, ExternalLink, IdCard, Inbox, LayoutDashboard, LayoutGrid, LineChart, LogOut, MessageSquareText, Settings, ShieldCheck, Users, X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { Link, usePathname } from "@/i18n/navigation";
import { ICON } from "@/components/admin/icon";
import { cn } from "@/lib/utils";

const ICONS = {
  overview: LayoutDashboard, visits: LineChart, voice: MessageSquareText, messages: Inbox, users: Users, roster: IdCard, setup: Settings, security: ShieldCheck,
  content: LayoutGrid, site: ExternalLink,
} satisfies Record<string, LucideIcon>;

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };
type Labels = { nav: string; manage: string; more: string; close: string; signOut: string; signedInAs: string; title: string };

const isActive = (pathname: string, href: string) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

function SignOutForm({ label, className }: { label: string; className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={cn("flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm", className)}>
        <LogOut {...ICON} />
        {label}
      </button>
    </form>
  );
}

/** Unread count, e.g. "3 ใหม่" for screen readers; capped at 99+ on screen. */
function Badge({ n, label, className }: { n: number; label: string; className?: string }) {
  return (
    <span className={cn("min-w-5 rounded-full bg-pink px-1.5 text-center text-[0.65rem] font-semibold leading-5 text-white", className)}>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/** Admin navigation: sidebar on desktop, bottom tab bar (+ "more" sheet) on phones. */
export function AdminNav({ primary, secondary, labels, email, role, newLabel }: { primary: NavItem[]; secondary: NavItem[]; labels: Labels; email: string; role: string; newLabel: string }) {
  const pathname = usePathname();
  // the sheet stays open only on the page it was opened on, so navigating closes it; Escape closes it too
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean) => setOpenOn(v ? pathname : null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sideLink = (i: NavItem) => {
    const Icon = ICONS[i.icon];
    const active = isActive(pathname, i.href);
    return (
      <li key={i.href}>
        <Link
          href={i.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
            active ? "bg-white/15 font-semibold text-white" : "text-on-brand/75 hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon {...ICON} strokeWidth={active ? 2.25 : 1.75} />
          <span className="flex-1">{i.label}</span>
          {!!i.badge && <Badge n={i.badge} label={newLabel} />}
        </Link>
      </li>
    );
  };

  return (
    <>
      <aside className="hidden bg-gradient-to-b from-brand-deep to-[#0b1f4d] text-on-brand lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:self-start lg:overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-6">
          <Link href="/admin" className="font-display text-lg font-semibold leading-tight">{labels.title}</Link>
          <LocaleSwitch />
        </div>
        <nav aria-label={labels.nav} className="no-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 pb-4">
          <ul className="space-y-1">{primary.map(sideLink)}</ul>
          <div>
            <p className="px-3 pb-2 text-xs font-medium text-on-brand/50">{labels.manage}</p>
            <ul className="space-y-1">{secondary.map(sideLink)}</ul>
          </div>
        </nav>
        <div className="space-y-1 border-t border-white/10 px-5 py-4 text-sm">
          <p className="text-on-brand/60">{labels.signedInAs}</p>
          <p className="truncate font-medium">{email}</p>
          <p className="w-fit rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{role}</p>
          <SignOutForm label={labels.signOut} className="-mx-3 mt-2 text-on-brand/80 hover:bg-white/10 hover:text-white" />
        </div>
      </aside>

      {/* phones: top bar + bottom tabs */}
      <header className="flex items-center justify-between gap-3 bg-brand-deep px-4 py-3 text-on-brand lg:hidden">
        <Link href="/admin" className="font-display text-base font-semibold">{labels.title}</Link>
        <LocaleSwitch />
      </header>
      <nav aria-label={labels.nav} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((i) => {
            const Icon = ICONS[i.icon];
            const active = isActive(pathname, i.href);
            return (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[0.7rem]", active ? "font-semibold text-pink-ink" : "text-muted")}
                >
                  <span className="relative">
                    <Icon {...ICON} size={20} strokeWidth={active ? 2.25 : 1.75} />
                    {!!i.badge && <Badge n={i.badge} label={newLabel} className="absolute -right-3 -top-1.5" />}
                  </span>
                  <span className="max-w-full truncate">{i.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="admin-more"
              className={cn("flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-1 text-[0.7rem]", secondary.some((i) => isActive(pathname, i.href)) ? "font-semibold text-pink-ink" : "text-muted")}
            >
              <Ellipsis {...ICON} size={20} />
              {labels.more}
            </button>
          </li>
        </ul>
      </nav>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={labels.close} className="absolute inset-0 bg-brand-deep/40" onClick={() => setOpen(false)} />
          <div id="admin-more" role="dialog" aria-modal="true" aria-label={labels.more} className="absolute inset-x-0 bottom-0 rounded-t-[24px] bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lift">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-display font-semibold text-strong">{labels.manage}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label={labels.close} title={labels.close} className="rounded-full p-2 text-muted hover:bg-surface-2">
                <X {...ICON} />
              </button>
            </div>
            <ul className="space-y-1">
              {secondary.map((i) => {
                const Icon = ICONS[i.icon];
                const active = isActive(pathname, i.href);
                return (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={active ? "page" : undefined} className={cn("flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm", active ? "bg-surface-2 font-semibold text-strong" : "text-ink hover:bg-surface-2")}>
                      <Icon {...ICON} />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 border-t border-line pt-3">
              <p className="truncate px-3 text-xs text-muted">{labels.signedInAs} {email} · {role}</p>
              <SignOutForm label={labels.signOut} className="mt-1 text-ink hover:bg-surface-2" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
