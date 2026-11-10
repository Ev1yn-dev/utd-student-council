"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ICON } from "@/components/admin/icon";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { Link, usePathname } from "@/i18n/navigation";
import type { NavGroup } from "./nav";
import { SidebarNav } from "./Sidebar";
import { TopBar, type Notice, type TopLabels } from "./TopBar";

export type ShellProps = {
  groups: NavGroup[]; years: number[]; current: number; pref: number | null; notices: Notice[]; email: string; role: string; canContent: boolean;
  labels: TopLabels & { nav: string };
};

function Brand({ title }: { title: string }) {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 font-display text-base font-semibold leading-tight text-white">
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized emblem, no optimizer (see lib/council-images.ts) */}
      <img src="/brand/logo-council-128.webp" alt="" width={32} height={32} className="h-8 w-8 rounded-full bg-white object-contain" />
      {title}
    </Link>
  );
}

/**
 * The one back-office frame: navy sidebar (desktop) or drawer (phones) + top bar + page. The drawer closes on
 * navigation, Escape and outside tap; focus moves into it when it opens and back to the menu button when it closes.
 */
export function AdminShell({ children, ...p }: ShellProps & { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const drawer = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    drawer.current?.querySelector<HTMLElement>("a,button")?.focus();
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      opener.current?.focus();
    };
  }, [open]);

  return (
    <div className="min-h-dvh bg-page lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden bg-gradient-to-b from-brand-deep to-brand text-on-brand lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:self-start">
        <div className="px-5 py-5"><Brand title={p.labels.title} /></div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6">
          <SidebarNav groups={p.groups} label={p.labels.nav} newLabel={p.labels.newLabel} />
        </div>
        <div className="border-t border-white/10 px-5 py-3"><LocaleSwitch /></div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={p.labels.close} className="absolute inset-0 bg-brand-deep/50" onClick={() => setOpenOn(null)} />
          <div ref={drawer} role="dialog" aria-modal="true" aria-label={p.labels.nav} className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col bg-gradient-to-b from-brand-deep to-brand text-on-brand shadow-lift">
            <div className="flex items-center justify-between gap-2 px-4 py-4">
              <Brand title={p.labels.title} />
              <button type="button" onClick={() => setOpenOn(null)} aria-label={p.labels.close} className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-on-brand/80 hover:bg-white/10">
                <X {...ICON} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              <SidebarNav groups={p.groups} label={p.labels.nav} newLabel={p.labels.newLabel} onNavigate={() => setOpenOn(null)} />
            </div>
          </div>
        </div>
      )}

      <div className="min-w-0">
        <TopBar
          groups={p.groups} years={p.years} current={p.current} pref={p.pref} notices={p.notices} email={p.email} role={p.role} canContent={p.canContent}
          labels={p.labels}
          onMenu={() => {
            opener.current = document.activeElement as HTMLElement | null;
            setOpenOn(pathname);
          }}
        />
        <main id="main" className="px-4 pb-16 pt-5 md:px-6 lg:px-8 lg:pt-6">{children}</main>
      </div>
    </div>
  );
}
