"use client";

import { useState } from "react";

// Up to 4 slices: blue, pink, navy, grey — each also named with its share in the legend (never colour alone).
const COLORS = ["var(--c-chart-1)", "var(--c-chart-2)", "var(--c-brand-deep)", "var(--c-planned)"];

/** Share of a whole (devices). Hover / focus a legend row to emphasise its slice. */
export function Donut({ items, summary, centerLabel, fmt = (n) => n.toLocaleString() }: {
  items: { label: string; n: number }[]; summary: string; centerLabel: string; fmt?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = items.reduce((a, b) => a + b.n, 0);
  const R = 70, r = 46, C = 2 * Math.PI * ((R + r) / 2), sw = R - r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg role="img" aria-label={summary} width={160} height={160} viewBox="0 0 160 160" className="chart-fade shrink-0">
        <g transform="translate(80 80) rotate(-90)">
          <circle r={(R + r) / 2} fill="none" stroke="var(--c-chart-grid)" strokeWidth={sw} />
          {total > 0 && items.map((it, i) => {
            const len = (it.n / total) * C;
            const el = (
              <circle
                key={it.label} r={(R + r) / 2} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={hover === i ? sw + 6 : sw}
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} style={{ transition: "stroke-width 150ms" }}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="80" y="76" textAnchor="middle" className="fill-strong font-display text-[22px] font-semibold tabular-nums">{fmt(total)}</text>
        <text x="80" y="96" textAnchor="middle" className="fill-muted text-[11px]">{centerLabel}</text>
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {items.map((it, i) => (
          <li key={it.label} tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
            className="flex items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-pink">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            <span className="tabular-nums text-muted"><b className="font-medium text-ink">{fmt(it.n)}</b> · {total ? Math.round((it.n / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
