"use client";

import { ChevronDown } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ICON } from "@/components/admin/icon";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_ICONS, activeItem, type NavGroup, type NavItem } from "./nav";

// folded groups, remembered in this browser (localStorage; the server renders every group open)
const STORE = "admin.nav.closed";
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
const snapshot = () => {
  try {
    return localStorage.getItem(STORE) ?? "[]";
  } catch {
    return "[]";
  }
};
const parse = (raw: string): string[] => {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};
const saveClosed = (keys: string[]) => {
  try {
    localStorage.setItem(STORE, JSON.stringify(keys));
  } catch {}
  listeners.forEach((fn) => fn());
};

/** Unread / pending count; "99+" on screen, full text for screen readers. */
export function CountBadge({ n, label, className }: { n: number; label: string; className?: string }) {
  return (
    <span className={cn("min-w-5 rounded-full bg-pink px-1.5 text-center text-[0.65rem] font-semibold leading-5 text-white", className)}>
      {n > 99 ? "99+" : n}
      <span className="sr-only"> {label}</span>
    </span>
  );
}

/**
 * Grouped menu (sidebar on desktop, drawer on phones). Groups fold open/closed (remembered in this browser); the group
 * of the current page is always open. Only items the account may use reach this component (the layout filters them).
 */
export function SidebarNav({ groups, label, newLabel, onNavigate }: { groups: NavGroup[]; label: string; newLabel: string; onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = activeItem(groups, pathname);
  const closed = parse(useSyncExternalStore(subscribe, snapshot, () => "[]"));
  const toggle = (key: string) => saveClosed(closed.includes(key) ? closed.filter((k) => k !== key) : [...closed, key]);

  const link = (i: NavItem) => {
    const Icon = NAV_ICONS[i.icon];
    const active = current?.item.href === i.href;
    return (
      <li key={i.href}>
        <Link
          href={i.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          {...(i.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className={cn(
            "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm transition-colors duration-150",
            active ? "bg-white/15 font-semibold text-white" : "text-on-brand/75 hover:bg-white/10 hover:text-white",
          )}
        >
          <Icon {...ICON} size={18} strokeWidth={active ? 2.25 : 1.75} />
          <span className="min-w-0 flex-1 truncate">{i.label}{i.external && <span aria-hidden> ↗</span>}</span>
          {!!i.badge && <CountBadge n={i.badge} label={newLabel} />}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label={label} className="space-y-4">
      {groups.map((g) => {
        if (!g.label) return <ul key={g.key} className="space-y-0.5">{g.items.map(link)}</ul>;
        const open = current?.group.key === g.key || !closed.includes(g.key);
        const id = `nav-${g.key}`;
        return (
          <div key={g.key}>
            <button
              type="button"
              onClick={() => toggle(g.key)}
              aria-expanded={open}
              aria-controls={id}
              className="flex min-h-8 w-full cursor-pointer items-center justify-between rounded-lg px-3 text-xs font-medium tracking-wide text-on-brand/55 transition-colors hover:text-on-brand"
            >
              {g.label}
              <ChevronDown {...ICON} size={14} className={cn("transition-transform duration-150 motion-reduce:transition-none", !open && "-rotate-90")} />
            </button>
            <ul id={id} hidden={!open} className="mt-0.5 space-y-0.5">{g.items.map(link)}</ul>
          </div>
        );
      })}
    </nav>
  );
}
