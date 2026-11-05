"use client";

import { useEffect, useRef, useState } from "react";
import type { Chart as ChartType } from "chart.js";

// Validated pair (dataviz palette check, light surface): blue for the first series, pink for the second / highlight.
export const SERIES_COLORS = ["#3159c4", "#e8508b"] as const;

type Series = { label: string; data: number[] };
type Props = {
  type: "line" | "bar";
  labels: string[];
  series: Series[];
  /** bar charts: index of the bar drawn in the highlight colour (also named in text next to the chart) */
  highlight?: number;
  /** accessible summary of what the chart shows */
  summary: string;
  loading: string;
  height?: number;
};

/** Chart.js canvas, imported only when the chart mounts (admin pages). Skeleton until it is drawn. */
export function StatChart({ type, labels, series, highlight, summary, loading, height = 260 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const key = JSON.stringify({ type, labels, series, highlight });

  useEffect(() => {
    let chart: ChartType | null = null;
    let alive = true;
    import("./chart-setup").then(({ Chart }) => {
      if (!alive || !canvas.current) return;
      const multi = series.length > 1;
      chart = new Chart(canvas.current, {
        type,
        data: {
          labels,
          datasets: series.map((s, i) => {
            const color = SERIES_COLORS[i % SERIES_COLORS.length];
            return type === "bar"
              ? { label: s.label, data: s.data, borderRadius: 4, borderSkipped: "start" as const, maxBarThickness: 56, backgroundColor: s.data.map((_, j) => (j === highlight ? SERIES_COLORS[1] : SERIES_COLORS[0])) }
              : { label: s.label, data: s.data, borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, pointHoverRadius: 4, tension: 0.25 };
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: {
            legend: { display: multi, position: "top", align: "end", labels: { usePointStyle: true, pointStyle: "line", boxWidth: 18 } },
            tooltip: { backgroundColor: "#050d24", padding: 10, cornerRadius: 10, displayColors: multi },
          },
          scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
            y: { beginAtZero: true, border: { display: false }, grid: { color: "#e6eaf2" }, ticks: { precision: 0 } },
          },
        },
      });
      setReady(true);
    });
    return () => {
      alive = false;
      chart?.destroy();
    };
    // `key` covers every input of the chart
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="relative" style={{ height }}>
      {!ready && <div className="absolute inset-0 animate-pulse rounded-xl bg-surface-2" aria-label={loading} />}
      <canvas ref={canvas} role="img" aria-label={summary} />
    </div>
  );
}
