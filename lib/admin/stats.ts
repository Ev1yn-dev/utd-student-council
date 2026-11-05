import "server-only";
import { adminClient } from "@/lib/supabase/admin";

// Aggregates for the admin statistics pages. Callers must have checked requireRole(["admin"]) first.
// Days are Asia/Bangkok calendar days (same as the SQL functions in migration 0014).

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const parseRange = (v: string | undefined): Range => (RANGES.find((r) => String(r) === v) ?? 30);

export type Count = { key: string; n: number };
export type DayPoint = { day: string; views: number; uniques: number };

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** The last `days` days, oldest first, ending today. */
export const lastDays = (days: number) => Array.from({ length: days }, (_, i) => addDays(today(), i - days + 1));

/** "5 พ.ย." / "5 Nov" for a YYYY-MM-DD day. */
export function dayLabel(locale: string) {
  const f = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (day: string) => f.format(new Date(`${day}T00:00:00Z`));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

type VisitRow = { dim: string; key: string; day: string | null; views: number | string; uniques: number | string };

async function visitRows(days: number) {
  const { data, error } = await adminClient().rpc("visit_report", { p_since: lastDays(days)[0] });
  if (error) throw new Error(`visit_report: ${error.message}`);
  return (data ?? []) as VisitRow[];
}

export async function visitReport(days: Range) {
  const rows = await visitRows(days);
  const byDay = new Map(rows.filter((r) => r.dim === "all" && r.day).map((r) => [r.day!, r]));
  const series: DayPoint[] = lastDays(days).map((day) => ({ day, views: Number(byDay.get(day)?.views ?? 0), uniques: Number(byDay.get(day)?.uniques ?? 0) }));
  const list = (dim: string): Count[] => rows.filter((r) => r.dim === dim).map((r) => ({ key: r.key, n: Number(r.views) })).sort((a, b) => b.n - a.n);
  return {
    series,
    views: sum(series.map((s) => s.views)),
    uniques: sum(series.map((s) => s.uniques)),
    pages: list("page"),
    refs: list("ref"),
    devices: list("device"),
    countries: list("country"),
  };
}

type VoiceRow = { dim: string; key: string; n: number | string };

async function voiceRows(days: number) {
  const { data, error } = await adminClient().rpc("voice_stats", { p_since: `${lastDays(days)[0]}T00:00:00+07:00` });
  if (error) throw new Error(`voice_stats: ${error.message}`);
  return (data ?? []) as VoiceRow[];
}

/** Counts only: per day, per grade (1–6, "" = not given) and per category. Never rows, names or messages. */
export async function voiceReport(days: Range) {
  const rows = await voiceRows(days);
  const of = (dim: string) => rows.filter((r) => r.dim === dim);
  const perDay = new Map(of("day").map((r) => [r.key, Number(r.n)]));
  const grade = new Map(of("grade").map((r) => [r.key, Number(r.n)]));
  const series = lastDays(days).map((day) => ({ day, n: perDay.get(day) ?? 0 }));
  return {
    series,
    total: sum(series.map((s) => s.n)),
    grades: [1, 2, 3, 4, 5, 6].map((g) => ({ grade: g, n: grade.get(String(g)) ?? 0 })),
    noGrade: grade.get("") ?? 0,
    categories: of("category").map((r) => ({ key: r.key, n: Number(r.n) })).sort((a, b) => b.n - a.n),
  };
}

/** Overview cards: each value with the one from the period before it. */
export async function overview() {
  const [v, s] = await Promise.all([visitRows(14), voiceRows(14)]);
  const days = lastDays(14);
  const prev = days.slice(0, 7), cur = days.slice(7);
  const all = new Map(v.filter((r) => r.dim === "all" && r.day).map((r) => [r.day!, r]));
  const views = (ds: string[]) => sum(ds.map((d) => Number(all.get(d)?.views ?? 0)));
  const uniques = (ds: string[]) => sum(ds.map((d) => Number(all.get(d)?.uniques ?? 0)));
  const perDay = new Map(s.filter((r) => r.dim === "day").map((r) => [r.key, Number(r.n)]));
  const voice = (ds: string[]) => sum(ds.map((d) => perDay.get(d) ?? 0));
  return {
    today: { now: views(days.slice(13)), prev: views(days.slice(12, 13)) },
    views7: { now: views(cur), prev: views(prev) },
    uniques7: { now: uniques(cur), prev: uniques(prev) },
    voice7: { now: voice(cur), prev: voice(prev) },
  };
}
