import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartBar } from "@phosphor-icons/react/ssr";
import { Link } from "@/i18n/navigation";
import { RANGES, type Range } from "@/lib/admin/stats";
import { cn } from "@/lib/utils";

export function PageHeader({ title, lead, children }: { title: string; lead: string; children?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold text-strong">{title}</h1>
        <p className="mt-1 text-sm text-muted">{lead}</p>
      </div>
      {children}
    </header>
  );
}

export function Card({ title, aside, children, className }: { title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-[20px] border border-line bg-surface p-5 shadow-soft", className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-strong">{title}</h2>
        {aside && <div className="text-sm text-muted">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-muted">
      <ChartBar size={28} aria-hidden />
      {text}
    </div>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return <p role="alert" className="rounded-xl border border-danger/30 bg-pink-soft px-4 py-3 text-sm text-danger">{text}</p>;
}

/** 7 / 30 / 90 day links (?range=), one row above the charts. */
export function RangeFilter({ pathname, value, label, days }: { pathname: string; value: Range; label: string; days: (n: number) => string }) {
  return (
    <nav aria-label={label} className="inline-flex rounded-full border border-line bg-surface p-1 text-sm">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={{ pathname, query: { range: String(r) } }}
          aria-current={r === value ? "page" : undefined}
          className={cn("rounded-full px-3.5 py-1.5 transition-colors", r === value ? "bg-brand font-semibold text-on-brand" : "text-muted hover:text-ink")}
        >
          {days(r)}
        </Link>
      ))}
    </nav>
  );
}

export type Delta = { kind: "up" | "down" | "same" | "fresh"; text: string };

export function delta(now: number, prev: number, t: (k: string, v?: Record<string, number>) => string): Delta {
  if (now === prev) return { kind: "same", text: t("same") };
  if (prev === 0) return { kind: "fresh", text: t("fresh") };
  const pct = Math.round((Math.abs(now - prev) / prev) * 100);
  return now > prev ? { kind: "up", text: t("up", { pct }) } : { kind: "down", text: t("down", { pct }) };
}

export function StatCard({ label, value, change, compare, href }: { label: string; value: string; change: Delta; compare: string; href: string }) {
  const Icon = change.kind === "down" ? ArrowDownRight : change.kind === "same" ? ArrowRight : ArrowUpRight;
  return (
    <Link href={href} className="block rounded-[20px] border border-line bg-surface p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-strong">{value}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium",
            change.kind === "up" || change.kind === "fresh" ? "bg-done/10 text-done" : change.kind === "down" ? "bg-danger/10 text-danger" : "bg-surface-2 text-muted",
          )}
        >
          <Icon size={14} weight="bold" aria-hidden />
          {change.text}
        </span>
        <span className="text-muted">{compare}</span>
      </p>
    </Link>
  );
}

/** Ranked horizontal bars (plain HTML, no chart library): label, count and share of the total. */
export function BarList({ items, empty, fmt }: { items: { label: string; n: number }[]; empty: string; fmt: (n: number) => string }) {
  const total = items.reduce((a, b) => a + b.n, 0);
  if (!total) return <Empty text={empty} />;
  const max = Math.max(...items.map((i) => i.n));
  return (
    <ul className="space-y-2.5">
      {items.map((i, idx) => (
        <li key={`${i.label}-${idx}`} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink" title={i.label}>{i.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-medium text-ink">{fmt(i.n)}</span> · {Math.round((i.n / total) * 100)}%
            </span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-surface-2">
            <div className="h-1.5 rounded-full bg-[#3159c4]" style={{ width: `${Math.max(2, (i.n / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[20px] bg-surface-2", className)} />;
}
