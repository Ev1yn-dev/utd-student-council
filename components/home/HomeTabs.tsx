"use client";

import { AnimatePresence, LayoutGroup, m, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { YearContent } from "@/lib/content";
import dynamic from "next/dynamic";
import { Illustration } from "@/components/icons/Illustration";
import { IconCalendar, IconChevronDown, IconClose, IconFlag, IconInfo, IconMegaphone, IconSearch, IconTeacher, IconUsers } from "@/components/icons/Icon";
import { useLocale, useTranslations } from "next-intl";
import { TAB_KEYS, filterContent, homeHref, tabCount, type TabKey } from "@/lib/search";
import { ceYear, cn } from "@/lib/utils";

const TAB_ICON: Record<TabKey, typeof IconUsers> = { news: IconMegaphone, policy: IconFlag, council: IconUsers, advisor: IconTeacher };

/**
 * Year select + search + tabs (sticky) and the tab content.
 * Tab changes stay client-side (history.replaceState keeps ?tab= shareable without a server round-trip);
 * a year change navigates so the server sends that year's data.
 */
// each tab is its own chunk: a page view loads only the tab it shows (server-rendered as before)
const NewsTab = dynamic(() => import("@/components/home/NewsTab").then((r) => r.NewsTab));
const PolicyTab = dynamic(() => import("@/components/home/PolicyTab").then((r) => r.PolicyTab));
const PeopleTab = dynamic(() => import("@/components/home/PeopleTab").then((r) => r.PeopleTab));

export function HomeTabs({ content, initialTab }: { content: YearContent; initialTab: TabKey }) {
  const router = useRouter();
  const tr = useTranslations();
  const locale = useLocale();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [dir, setDir] = useState(1);
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query);
  const [pending, startTransition] = useTransition();
  const [stuck, setStuck] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tabsEl = useRef<HTMLDivElement>(null);

  const view = useMemo(() => filterContent(content, q), [content, q]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // phones: keep the active tab visible in the horizontally scrolling tab list (scrolls the list only)
  useEffect(() => {
    const list = tabsEl.current;
    const b = list?.querySelector<HTMLElement>(`#tab-${tab}`);
    if (list && b) list.scrollTo({ left: b.offsetLeft - (list.clientWidth - b.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [tab, reduce, locale]);

  // Hold the panel's height while one tab/year leaves and the next enters, so the page below never jumps.
  const lockHeight = () => {
    const el = panel.current;
    if (el) el.style.minHeight = `${el.offsetHeight}px`;
  };
  const unlockHeight = () => {
    if (panel.current) panel.current.style.minHeight = "";
  };

  // When the bar is stuck, jump (no smooth scroll) to the top of the content BEFORE switching: the highlight's layout
  // animation then measures a page that is not moving, so it stays inside the tab frame.
  const scrollToContent = () => {
    if (stuck) sentinel.current?.scrollIntoView({ behavior: "auto", block: "start" });
  };

  const selectTab = (t: TabKey) => {
    if (t === tab) return;
    setDir(TAB_KEYS.indexOf(t) > TAB_KEYS.indexOf(tab) ? 1 : -1);
    scrollToContent();
    lockHeight();
    setTab(t);
    window.history.replaceState(null, "", homeHref(locale, t, content.year, content.current));
  };

  const selectYear = (y: number) => {
    lockHeight();
    startTransition(() => router.push(homeHref(locale, tab, y, content.current), { scroll: false }));
  };

  const clear = () => setQuery("");

  return (
    <div className="mx-auto max-w-[1320px] px-4 pb-6">
      <div ref={sentinel} aria-hidden className="h-px" />
      <div className="sticky top-0 z-20 -mx-4 px-4 pt-3 sm:top-2">
        <div
          className={cn(
            "relative rounded-[20px] border border-line bg-surface/90 p-3 backdrop-blur-xl transition-shadow duration-300 sm:p-4",
            stuck ? "shadow-[0_14px_40px_-16px_rgb(11_31_77/0.35)]" : "shadow-soft",
          )}
        >
          <span aria-hidden className="absolute inset-x-6 top-0 h-[3px] rounded-b-full bg-gradient-to-r from-brand-mid via-pink to-gold" />
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <div className="flex gap-2.5 lg:w-[480px] lg:shrink-0">
              <label className="block w-[136px] shrink-0 sm:w-[176px]">
                <span data-swap className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <IconCalendar width={14} height={14} /> {tr("year.label")}
                </span>
                <span className="relative block">
                  <select
                    value={content.year}
                    onChange={(e) => selectYear(Number(e.target.value))}
                    className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-line bg-surface pl-3 pr-9 text-[0.95rem] font-medium text-ink outline-none transition focus:border-pink"
                    aria-busy={pending}
                  >
                    {content.years.map((y) => <option key={y} value={y}>{tr("year.option", { be: y, ce: ceYear(y) })}</option>)}
                  </select>
                  <IconChevronDown width={16} height={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" />
                </span>
              </label>
              <label className="block min-w-0 flex-1">
                <span data-swap className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted">
                  <IconSearch width={14} height={14} /> {tr("search.label")}
                </span>
                <span className="relative block">
                  <IconSearch width={17} height={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tr("search.placeholder")}
                    aria-label={tr("search.aria")}
                    className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-10 text-[0.95rem] text-ink outline-none transition placeholder:text-muted/80 focus:border-pink [&::-webkit-search-cancel-button]:hidden"
                  />
                  <AnimatePresence>
                    {query && (
                      <m.button
                        type="button"
                        onClick={clear}
                        aria-label={tr("search.clear")}
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-surface-2 text-muted hover:text-ink"
                      >
                        <IconClose width={14} height={14} />
                      </m.button>
                    )}
                  </AnimatePresence>
                </span>
              </label>
            </div>

            <div
              ref={tabsEl}
              role="tablist"
              aria-label={tr("tabs.aria")}
              className="no-scrollbar relative flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-2xl bg-surface-2 p-1"
            >
              <LayoutGroup id="home-tabs">
              {TAB_KEYS.map((t) => {
                const Icon = TAB_ICON[t];
                const label = tr(`tabs.${t}`);
                const active = t === tab;
                const n = view.q ? tabCount(view, t) : null;
                return (
                  // a real link (crawlable, opens in a new tab with the modifier keys); a plain click switches in place
                  <a
                    key={t}
                    id={`tab-${t}`}
                    href={homeHref(locale, t, content.year, content.current)}
                    role="tab"
                    aria-selected={active}
                    aria-controls="tab-panel"
                    onClick={(e) => {
                      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      selectTab(t);
                    }}
                    className={cn(
                      "relative flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[0.9rem] font-medium whitespace-nowrap transition-colors lg:flex-1 lg:px-2",
                      active ? "text-on-brand" : "text-muted hover:text-strong",
                    )}
                  >
                    {/* one highlight, rendered (also on the server) inside the active tab; layoutId slides it to the next tab */}
                    {active && (
                      <m.span
                        layoutId="tab-highlight"
                        aria-hidden
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand to-brand-mid shadow-[0_6px_16px_-8px_var(--c-brand)]"
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                      />
                    )}
                    <Icon width={17} height={17} className="relative" />
                    <span data-swap className="relative">{label}</span>
                    {n !== null && (
                      <span className={cn("relative rounded-full px-1.5 text-[0.7rem] font-semibold", active ? "bg-white/20" : n ? "bg-pink text-white" : "bg-line text-muted")}>{n}</span>
                    )}
                  </a>
                );
              })}
              </LayoutGroup>
            </div>
          </div>
        </div>
      </div>
      {/* always shown, outside the sticky part: nothing appears/disappears while scrolling (no layout shift) */}
      <p data-swap className="mt-2.5 flex items-start gap-1.5 px-1 text-[0.75rem] text-muted">
        <IconInfo width={14} height={14} className="mt-0.5 shrink-0" /> {tr("site.dataNote")}
      </p>

      <div
        ref={panel}
        id="tab-panel"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        aria-busy={pending}
        className={cn("relative isolate mt-6 transition-opacity duration-300", pending && "pointer-events-none opacity-50")}
      >
        <Illustration name="decor-mandapa" className="pointer-events-none absolute right-0 top-0 -z-10 hidden w-56 opacity-[0.06] md:block" />
        <Illustration name="decor-kaefarang" className="pointer-events-none absolute bottom-0 left-0 -z-10 hidden w-44 opacity-[0.08] md:block" />
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <m.div
            key={`${tab}-${content.year}`}
            custom={dir}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onAnimationComplete={(def) => (def as { opacity?: number }).opacity === 1 && unlockHeight()}
          >
            {tab === "news" && <NewsTab announcements={view.announcements} activities={view.activities} query={view.q} onClear={clear} />}
            {tab === "policy" && <PolicyTab policies={view.policies} query={view.q} onClear={clear} />}
            {(tab === "council" || tab === "advisor") && (
              <PeopleTab kind={tab} members={view.members} advisors={view.advisors} year={content.year} query={view.q} onClear={clear} />
            )}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
