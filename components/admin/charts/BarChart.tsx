"use client";

import { useState } from "react";
import { C1, C2, GRID, niceTicks, useWidth } from "./svg";

export type Bar = { key: string; label: string; n: number };

/**
 * Vertical bars. `highlight` is drawn in the second colour (and named in text by the caller). With `onSelect`, each
 * bar is a button (drill-down); `selected` gets a ring. Values are printed above the bars (not colour-only).
 */
export function BarChart({ bars, summary, highlight, selected, onSelect, selectLabel, height = 220, fmt = (n) => n.toLocaleString() }: {
  bars: Bar[]; summary: string; highlight?: string; selected?: string | null; onSelect?: (key: string) => void; selectLabel?: (b: Bar) => string;
  height?: number; fmt?: (n: number) => string;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<string | null>(null);
  const pad = { l: 36, r: 8, t: 18, b: 26 };
  const iw = w - pad.l - pad.r, ih = height - pad.t - pad.b;
  const ticks = niceTicks(Math.max(1, ...bars.map((b) => b.n)));
  const top = ticks[ticks.length - 1];
  const slot = iw / Math.max(1, bars.length);
  const bw = Math.min(56, slot * 0.62);
  const y = (v: number) => pad.t + ih - (v / top) * ih;

  return (
    <div ref={ref}>
      <svg role="img" aria-label={summary} width={w} height={height} className="block">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
            <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">{fmt(t)}</text>
          </g>
        ))}
        {bars.map((b, i) => {
          const cx = pad.l + slot * i + slot / 2;
          const on = b.key === highlight;
          return (
            <g key={b.key} onPointerEnter={() => setHover(b.key)} onPointerLeave={() => setHover(null)}>
              <rect
                className="chart-grow" x={cx - bw / 2} y={y(b.n)} width={bw} height={Math.max(0, y(0) - y(b.n))} rx={4}
                fill={on ? C2 : C1} fillOpacity={hover && hover !== b.key ? 0.55 : 1}
                stroke={selected === b.key ? "var(--c-brand-deep)" : "none"} strokeWidth={2}
              />
              <text x={cx} y={y(b.n) - 5} textAnchor="middle" className="fill-ink text-[11px] font-medium tabular-nums">{fmt(b.n)}</text>
              <text x={cx} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">{b.label}</text>
            </g>
          );
        })}
      </svg>
      {onSelect && (
        // the bars as real buttons (keyboard + screen readers); laid over the plot, same order
        <div className="-mt-[26px] flex" style={{ paddingLeft: pad.l, paddingRight: pad.r }}>
          {bars.map((b) => (
            <button
              key={b.key} type="button" onClick={() => onSelect(b.key)} aria-pressed={selected === b.key}
              className="min-h-[26px] flex-1 cursor-pointer rounded-md text-[0] focus-visible:text-[0]"
            >
              {selectLabel ? selectLabel(b) : b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
