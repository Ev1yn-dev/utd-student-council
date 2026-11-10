"use client";

import { useEffect, useRef, useState } from "react";

// Small helpers shared by the back-office SVG charts (no chart library; admin bundle only).

export const C1 = "var(--c-chart-1)";
export const C2 = "var(--c-chart-2)";
export const GRID = "var(--c-chart-grid)";

/** Width of an element, kept up to date (charts draw in real pixels, so text never scales). */
export function useWidth<T extends HTMLElement>(initial = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** "Nice" upper bound and 3–5 ticks for a y axis starting at 0. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks.map((v) => (Number.isInteger(step) ? Math.round(v) : v));
}
