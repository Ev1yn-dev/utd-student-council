"use client";

import { Bell, ChevronRight, ExternalLink, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { searchContent, setAdminYear, type SearchHit } from "@/app/actions/admin";
import { ICON } from "@/components/admin/icon";
import { LocaleSwitch } from "@/components/i18n/LocaleSwitch";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_ICONS, activeItem, type NavGroup, type NavItem } from "./nav";
import { CountBadge } from "./Sidebar";

export type Notice = { href: string; text: string; n: number };
export type TopLabels = {
  title: string; home: string; breadcrumb: string; menu: string; year: string; yearOptions: Record<string, string>; search: string; searchHint: string;
  searchEmpty: string; searchPages: string; searchContent: string; notifications: string; notificationsEmpty: string; account: string;
  signOut: string; site: string; edit: string; create: string; entities: Record<string, string>; newLabel: string; close: string;
};

/** Click outside / Escape closes a popover; focus goes back to its button on Escape. */
function usePopover() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return [open, setOpen, box, btn] as const;
}

const iconBtn = "relative grid h-10 w-10 cursor-pointer place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink";
const panel = "absolute right-0 top-12 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-2 shadow-lift";

/** The year the page shows: ?year= when it is a known year, else this account's last pick, else the current year. */
function useShownYear(years: number[], current: number, pref: number | null) {
  const sp = useSearchParams();
  const q = Number(sp.get("year"));
  return years.includes(q) ? q : pref && years.includes(pref) ? pref : current;
}

function YearPicker({ years, current, pref, labels }: { years: number[]; current: number; pref: number | null; labels: TopLabels }) {
  const shown = useShownYear(years, current, pref);
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const change = (y: number) =>
    start(async () => {
      await setAdminYear(y);
      const query = Object.fromEntries([...sp.entries()].filter(([k]) => k !== "page" && k !== "year"));
      router.replace({ pathname, query: { ...query, year: String(y) } });
    });
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      <span className="hidden md:inline">{labels.year}</span>
      <select
        value={shown}
        onChange={(e) => change(Number(e.target.value))}
        disabled={pending}
        aria-label={labels.year}
        className="h-10 cursor-pointer rounded-xl border border-line bg-surface px-3 font-medium text-ink disabled:opacity-60"
      >
        {years.map((y) => <option key={y} value={y}>{labels.yearOptions[y] ?? y}</option>)}
      </select>
    </label>
  );
}

/** Ctrl/⌘ K or the search button: menu pages, plus content titles of the shown year (content.edit). */
function SearchDialog({ groups, canContent, year, labels, onClose }: { groups: NavGroup[]; canContent: boolean; year: number; labels: TopLabels; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  useEffect(() => input.current?.focus(), []);
  const searchable = canContent && q.trim().length >= 2;
  useEffect(() => {
    if (!searchable) return;
    const id = setTimeout(() => searchContent(q, year).then(setHits).catch(() => setHits([])), 250);
    return () => clearTimeout(id);
  }, [q, year, searchable]);
  const shownHits = searchable ? hits : [];
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  const term = q.trim().toLowerCase();
  const pages: NavItem[] = term ? groups.flatMap((g) => g.items).filter((i) => i.label.toLowerCase().includes(term)) : groups.flatMap((g) => g.items);
  const row = "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm text-ink hover:bg-surface-2 focus-visible:bg-surface-2";
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-brand-deep/40 p-4 pt-[12vh]" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={labels.search} className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-lift">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <Search {...ICON} className="text-muted" />
          <input
            ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder={labels.searchHint} aria-label={labels.search} aria-controls={listId}
            className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <button type="button" onClick={onClose} aria-label={labels.close} className={iconBtn}><X {...ICON} /></button>
        </div>
        <div id={listId} className="max-h-[55vh] overflow-y-auto p-2">
          {pages.length > 0 && <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{labels.searchPages}</p>}
          <ul>
            {pages.map((i) => {
              const Icon = NAV_ICONS[i.icon];
              return (
                <li key={i.href}>
                  <Link href={i.href} onClick={onClose} className={row} {...(i.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    <Icon {...ICON} className="text-muted" />{i.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          {shownHits.length > 0 && <p className="px-3 pb-1 pt-3 text-xs font-medium text-muted">{labels.searchContent}</p>}
          <ul>
            {shownHits.map((h) => (
              <li key={`${h.entity}-${h.id}`}>
                <Link href={{ pathname: `/admin/content/${h.entity}/${h.id}`, query: { year: String(year) } }} onClick={onClose} className={row}>
                  <span className="min-w-0 flex-1 truncate">{h.title}</span>
                  <span className="shrink-0 text-xs text-muted">{labels.entities[h.entity]}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!pages.length && !shownHits.length && <p className="px-3 py-6 text-center text-sm text-muted">{labels.searchEmpty}</p>}
        </div>
      </div>
    </div>
  );
}

export function TopBar({ groups, years, current, pref, notices, email, role, canContent, labels, onMenu }: {
  groups: NavGroup[]; years: number[]; current: number; pref: number | null; notices: Notice[]; email: string; role: string; canContent: boolean;
  labels: TopLabels; onMenu: () => void;
}) {
  const pathname = usePathname();
  const hit = activeItem(groups, pathname);
  const shownYear = useShownYear(years, current, pref);
  const [searching, setSearching] = useState(false);
  const [bellOpen, setBellOpen, bellBox, bellBtn] = usePopover();
  const [acctOpen, setAcctOpen, acctBox, acctBtn] = usePopover();
  const total = notices.reduce((a, n) => a + n.n, 0);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearching(true);
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);

  // breadcrumb: back office › group › page (› edit / new under a content list)
  const rest = hit && hit.item.href !== pathname ? pathname.slice(hit.item.href.length + 1).split("/")[0] : "";
  const tail = rest === "new" ? labels.create : rest ? labels.edit : null;
  const title = tail ?? hit?.item.label ?? labels.title;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="flex min-h-16 items-center gap-2 px-4 md:px-6">
        <button type="button" onClick={onMenu} aria-label={labels.menu} className={cn(iconBtn, "-ml-2 lg:hidden")}><Menu {...ICON} size={20} /></button>
        <div className="min-w-0 flex-1">
          <nav aria-label={labels.breadcrumb} className="hidden text-xs text-muted sm:block">
            <ol className="flex min-w-0 items-center gap-1">
              <li><Link href="/admin" className="hover:text-ink">{labels.home}</Link></li>
              {hit?.group.label && <li className="flex items-center gap-1"><ChevronRight {...ICON} size={12} />{hit.group.label}</li>}
              {hit && hit.item.href !== "/admin" && (
                <li className="flex min-w-0 items-center gap-1">
                  <ChevronRight {...ICON} size={12} />
                  {tail ? <Link href={{ pathname: hit.item.href, query: { year: String(shownYear) } }} className="truncate hover:text-ink">{hit.item.label}</Link> : <span aria-current="page" className="truncate">{hit.item.label}</span>}
                </li>
              )}
              {tail && <li className="flex items-center gap-1"><ChevronRight {...ICON} size={12} /><span aria-current="page">{tail}</span></li>}
            </ol>
          </nav>
          <p className="truncate font-display text-lg font-semibold leading-tight text-strong">{title}</p>
        </div>

        {hit?.item.yearScoped !== false && <YearPicker years={years} current={current} pref={pref} labels={labels} />}

        <button type="button" onClick={() => setSearching(true)} aria-label={labels.search} title={`${labels.search} (Ctrl K)`} className={iconBtn}><Search {...ICON} /></button>

        <div ref={bellBox} className="relative">
          <button ref={bellBtn} type="button" onClick={() => setBellOpen((o) => !o)} aria-expanded={bellOpen} aria-haspopup="true" aria-label={labels.notifications} className={iconBtn}>
            <Bell {...ICON} />
            {total > 0 && <CountBadge n={total} label={labels.newLabel} className="absolute -right-0.5 -top-0.5" />}
          </button>
          {bellOpen && (
            <div className={panel}>
              <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{labels.notifications}</p>
              {notices.length ? (
                <ul>
                  {notices.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} onClick={() => setBellOpen(false)} className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink hover:bg-surface-2">
                        <span className="min-w-0 flex-1">{n.text}</span><ChevronRight {...ICON} size={14} className="text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-3 py-4 text-sm text-muted">{labels.notificationsEmpty}</p>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:block"><LocaleSwitch variant="row" compact /></div>

        <div ref={acctBox} className="relative">
          <button ref={acctBtn} type="button" onClick={() => setAcctOpen((o) => !o)} aria-expanded={acctOpen} aria-haspopup="true" aria-label={labels.account} className={cn(iconBtn, "bg-surface-2 text-brand-mid")}>
            <UserRound {...ICON} />
          </button>
          {acctOpen && (
            <div className={panel}>
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium text-ink">{email}</p>
                <p className="mt-1 w-fit rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{role}</p>
              </div>
              <div className="px-3 py-2 sm:hidden"><LocaleSwitch variant="row" compact /></div>
              <Link href="/" target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-ink hover:bg-surface-2">
                <ExternalLink {...ICON} />{labels.site}
              </Link>
              <form action="/auth/signout" method="post">
                <button type="submit" className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-ink hover:bg-surface-2">
                  <LogOut {...ICON} />{labels.signOut}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      {searching && <SearchDialog groups={groups} canContent={canContent} year={shownYear} labels={labels} onClose={() => setSearching(false)} />}
    </header>
  );
}
