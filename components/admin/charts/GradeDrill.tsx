"use client";

import { useState } from "react";
import { BarChart } from "./BarChart";

/**
 * Council voice per grade (ม.1–ม.6), the top grade in the highlight colour. Tap / Enter on a grade lists its rooms
 * (counts only). `gradeFormat` / `roomFormat` are message templates ("ม.{g}", "ห้อง {room}").
 */
export function GradeDrill({ grades, rooms, top, summary, gradeFormat, roomFormat, roomsTitle, roomsHint, noRooms, showRooms }: {
  grades: { grade: number; n: number }[]; rooms: { grade: number; room: string; n: number }[]; top: number | null; summary: string;
  gradeFormat: string; roomFormat: string; roomsTitle: string; roomsHint: string; noRooms: string; showRooms: string;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const g = (n: number) => gradeFormat.replace("{g}", String(n));
  const list = sel ? rooms.filter((r) => String(r.grade) === sel) : [];
  const max = Math.max(1, ...list.map((r) => r.n));
  return (
    <div>
      <BarChart
        bars={grades.map((x) => ({ key: String(x.grade), label: g(x.grade), n: x.n }))}
        summary={summary}
        highlight={top !== null ? String(top) : undefined}
        selected={sel}
        onSelect={(k) => setSel((s) => (s === k ? null : k))}
        selectLabel={(b) => showRooms.replace("{grade}", b.label)}
      />
      <div aria-live="polite" className="mt-4">
        {!sel ? (
          <p className="text-xs text-muted">{roomsHint}</p>
        ) : (
          <div className="rounded-xl bg-surface-2 p-4">
            <p className="mb-2 text-sm font-semibold text-strong">{roomsTitle.replace("{grade}", g(Number(sel)))}</p>
            {list.length ? (
              <ul className="space-y-2">
                {list.map((r) => (
                  <li key={r.room} className="text-sm">
                    <div className="flex justify-between gap-3"><span>{roomFormat.replace("{room}", r.room)}</span><b className="tabular-nums">{r.n.toLocaleString()}</b></div>
                    <div className="mt-1 h-1.5 rounded-full bg-surface"><div className="h-1.5 rounded-full bg-[var(--c-chart-1)]" style={{ width: `${Math.max(3, (r.n / max) * 100)}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{noRooms}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
