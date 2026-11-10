/** Tiny trend line for KPI cards (decorative: the card states the number and the change in text). Server-renderable. */
export function Sparkline({ data, width = 120, height = 32, tone = "var(--c-chart-1)" }: { data: number[]; width?: number; height?: number; tone?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(1, ...data), n = data.length;
  const pts = data.map((v, i) => `${((i / (n - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="chart-fade overflow-visible">
      <path d={`M${pts.join("L")}L${width - 1},${height}L1,${height}Z`} fill={tone} fillOpacity={0.12} />
      <path d={`M${pts.join("L")}`} fill="none" stroke={tone} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
