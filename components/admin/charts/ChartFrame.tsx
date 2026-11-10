"use client";

import { ChartColumn, Table2 } from "lucide-react";
import { useState } from "react";
import { ICON } from "@/components/admin/icon";

export type ChartTable = { columns: string[]; rows: (string | number)[][] };
export type FrameLabels = { table: string; chart: string };

/**
 * One chart with its "ดูเป็นตาราง" switch: the same numbers as a plain table (screen readers, exact values, copying).
 * The chart itself is role="img" with an aria-label that states the gist.
 */
export function ChartFrame({ table, labels, fmt, children }: { table: ChartTable; labels: FrameLabels; fmt?: (n: number) => string; children: React.ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  const cell = (v: string | number) => (typeof v === "number" ? (fmt ? fmt(v) : v.toLocaleString()) : v);
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 text-xs font-medium text-muted transition-colors duration-150 hover:border-brand-mid hover:text-ink"
        >
          {asTable ? <ChartColumn {...ICON} size={14} /> : <Table2 {...ICON} size={14} />}
          {asTable ? labels.chart : labels.table}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-80 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
              <tr>{table.columns.map((c, i) => <th key={c} scope="col" className={i ? "px-3 py-2 text-right font-medium" : "px-3 py-2 font-medium"}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-line">
                  {r.map((v, j) => (j === 0 ? <th key={j} scope="row" className="px-3 py-1.5 font-normal">{cell(v)}</th> : <td key={j} className="px-3 py-1.5 text-right tabular-nums">{cell(v)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
