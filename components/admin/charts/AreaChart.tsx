"use client";

import { useState } from "react";
import { C1, C2, GRID, niceTicks, useWidth } from "./svg";

type Series = { label: string; data: number[] };

/**
 * Time series as an area (first series) + line (second series, dashed so it is not told apart by colour alone).
 * Hover / tap / arrow keys show the values of one day. `summary` is the chart's accessible name.
 */
export function AreaChart({ labels, series, summary, height = 240, fmt = (n) => n.toLocaleString() }: {
  labels: string[]; series: Series[]; summary: string; height?: number; fmt?: (n: number) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 12, t: 12, b: 26 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.data));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  const line = (d: number[]) => d.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = (d: number[]) => `${line(d)}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z`;
  // about 6 x labels whatever the width
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 90))));

  const pick = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    const i = Math.round(((clientX - r.left - pad.l) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setHover((h) => Math.min(n - 1, Math.max(0, (h ?? (e.key === "ArrowRight" ? -1 : n)) + (e.key === "ArrowRight" ? 1 : -1))));
    } else if (e.key === "Escape") setHover(null);
  };

  return (
    <div ref={ref} className="relative outline-none" tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)} aria-label={summary}>
      <svg
        role="img" aria-label={summary} width={w} height={height} className="block touch-pan-y select-none"
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerDown={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">{fmt(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (i % every === 0 || i === n - 1) && (n - 1 - i >= every / 2 || i === n - 1) ? (
          <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-muted text-[11px]">{l}</text>
        ) : null)}
        {series[0] && (
          <g className="chart-grow">
            <path d={area(series[0].data)} fill={C1} fillOpacity={0.14} />
            <path d={line(series[0].data)} fill="none" stroke={C1} strokeWidth={2} strokeLinejoin="round" />
          </g>
        )}
        {series[1] && <path className="chart-fade" d={line(series[1].data)} fill="none" stroke={C2} strokeWidth={2} strokeDasharray="5 3" strokeLinejoin="round" />}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--c-muted)" strokeDasharray="2 3" />
            {series.map((s, k) => <circle key={k} cx={x(hover)} cy={y(s.data[hover])} r={4} fill={k ? C2 : C1} stroke="white" strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-4 text-xs text-muted" aria-hidden>
          {series.map((s, k) => (
            <li key={s.label} className="flex items-center gap-1.5">
              <svg width="18" height="6"><line x1="0" x2="18" y1="3" y2="3" stroke={k ? C2 : C1} strokeWidth="2" strokeDasharray={k ? "5 3" : undefined} /></svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <div aria-live="polite" className="pointer-events-none">
        {hover !== null && (
          <div
            className="absolute top-1 z-10 min-w-32 rounded-xl bg-brand-deep px-3 py-2 text-xs text-on-brand shadow-lift"
            style={{ left: Math.min(Math.max(0, x(hover) - 64), w - 140) }}
          >
            <p className="font-semibold">{labels[hover]}</p>
            {series.map((s) => <p key={s.label} className="tabular-nums">{s.label}: <b>{fmt(s.data[hover])}</b></p>)}
          </div>
        )}
      </div>
    </div>
  );
}
