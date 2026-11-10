"use client";

import { useState } from "react";

/**
 * Day of week × hour of day (Bangkok time). Cell = views; darker = more, with a numeric legend; hover / focus a cell
 * for its exact value. `days` are the row labels Monday..Sunday (ISO 1..7).
 */
export function Heatmap({ cells, days, summary, hourFormat, fmt = (n) => n.toLocaleString() }: {
  /** key "<1-7>-<00-23>" -> views */
  cells: Record<string, number>; days: string[]; summary: string; /** e.g. "{h}:00 น." */ hourFormat: string; fmt?: (n: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(0, ...Object.values(cells));
  const v = (d: number, h: number) => cells[`${d}-${String(h).padStart(2, "0")}`] ?? 0;
  const shade = (n: number) => (n === 0 || max === 0 ? "var(--c-surface-2)" : `color-mix(in srgb, var(--c-chart-1) ${Math.round(18 + (n / max) * 82)}%, white)`);
  const [hd, hh] = hover ? hover.split("-").map(Number) : [0, 0];
  return (
    <div>
      <div className="overflow-x-auto">
        <table role="img" aria-label={summary} className="chart-fade border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr>
              <th />
              {Array.from({ length: 24 }, (_, h) => <th key={h} className="w-5 font-normal text-muted">{h % 3 === 0 ? h : ""}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map((dl, i) => (
              <tr key={dl}>
                <th className="pr-1 text-right font-normal text-muted">{dl}</th>
                {Array.from({ length: 24 }, (_, h) => {
                  const key = `${i + 1}-${h}`;
                  return (
                    <td key={h}>
                      <span
                        onPointerEnter={() => setHover(key)} onPointerLeave={() => setHover(null)} onPointerDown={() => setHover(key)}
                        className="block h-5 w-5 rounded-[3px]" style={{ background: shade(v(i + 1, h)) }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p aria-live="polite" className="min-h-4">{hover ? `${days[hd - 1]} ${hourFormat.replace("{h}", String(hh))} · ${fmt(v(hd, hh))}` : ""}</p>
        <p className="flex items-center gap-1.5" aria-hidden>
          0
          {[0.2, 0.45, 0.7, 1].map((f) => <span key={f} className="h-3 w-5 rounded-[3px]" style={{ background: shade(f * max || 1) }} />)}
          {fmt(max)}
        </p>
      </div>
    </div>
  );
}
