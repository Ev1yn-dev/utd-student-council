import { NextResponse } from "next/server";
import { listAudit } from "@/lib/admin/audit-log";
import { ENTITIES, ENTITY_KEYS, rowColumns } from "@/lib/admin/entities";
import { lastDays } from "@/lib/admin/stats";
import { audit, authorizePermission, hasPermission } from "@/lib/auth";
import { getYears } from "@/lib/content";
import { adminClient } from "@/lib/supabase/admin";

// data.export: CSV downloads for the "data & reset" page. Every export is written to admin_audit.
//   ?kind=content&year=2569  every content row of one year (all five types, one CSV, a "type" column first)
//   ?kind=visits             daily visit counts of the last 90 days
//   ?kind=messages           council voice messages; sender columns only with messages.read + messages.identity.view
//   ?kind=audit              admin audit log (last year)

const KINDS = ["content", "visits", "messages", "audit"] as const;
type Kind = (typeof KINDS)[number];
const notFound = () => new NextResponse("Not Found", { status: 404, headers: { "cache-control": "no-store" } });

/** RFC 4180 field; a leading = + - @ is prefixed with ' so a spreadsheet never runs it as a formula. */
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const csv = (cols: string[], rows: Record<string, unknown>[]) => [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");

export async function GET(req: Request) {
  const s = await authorizePermission("data.export");
  if (!s) return notFound();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as Kind;
  if (!KINDS.includes(kind)) return new NextResponse("Bad Request", { status: 400 });
  const db = adminClient();
  let body = "";
  let name: string = kind;
  const detail: Record<string, unknown> = {};

  if (kind === "content") {
    const { years, current } = await getYears();
    const year = years.includes(Number(url.searchParams.get("year"))) ? Number(url.searchParams.get("year")) : current;
    const cols = ["type", "id", "year", "status", ...new Set(ENTITY_KEYS.flatMap((k) => rowColumns(ENTITIES[k]))), "created_at", "updated_at"];
    const rows = (await Promise.all(ENTITY_KEYS.map(async (k) => {
      const { data } = await db.from(k).select("*").eq("year", year);
      return ((data ?? []) as Record<string, unknown>[]).map((r): Record<string, unknown> => ({ ...r, type: k }));
    }))).flat();
    // contact columns of people stay out of exports unless the person agreed to publish them
    for (const r of rows) if (!r.consent_public) { r.instagram = ""; r.contact = ""; }
    body = csv(cols.filter((c) => rows.some((r) => c in r)), rows);
    name = `content-${year}`;
    Object.assign(detail, { year, rows: rows.length });
  } else if (kind === "visits") {
    const { data } = await db.from("visit_stats").select("day,dim,key,views,uniques").gte("day", lastDays(90)[0]).order("day");
    body = csv(["day", "dim", "key", "views", "uniques"], (data ?? []) as Record<string, unknown>[]);
    detail.rows = data?.length ?? 0;
  } else if (kind === "messages") {
    if (!hasPermission(s, "messages.read")) return notFound();
    const identity = hasPermission(s, "messages.identity.view");
    const cols = ["ref_code", "created_at", "category", "grade", "message", "status", "read_at", "flagged", ...(identity ? ["student_id", "sender_prefix", "sender_first_name", "sender_last_name", "sender_room"] : [])];
    const { data } = await db.from("voice_messages").select(cols.join(",")).order("created_at", { ascending: false }).limit(10000);
    body = csv(cols, (data ?? []) as unknown as Record<string, unknown>[]);
    Object.assign(detail, { rows: data?.length ?? 0, identity });
    if (identity) await audit(s, "message.identity", "voice_messages", { via: "export", rows: data?.length ?? 0 });
  } else {
    if (!hasPermission(s, "security.view")) return notFound();
    const { rows } = await listAudit({ page: 1 }, 10000);
    body = csv(["created_at", "actor_email", "action", "target", "details", "ip_hash"], rows as unknown as Record<string, unknown>[]);
    detail.rows = rows.length;
  }

  await audit(s, "data.export", kind, detail);
  const stamp = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
  // BOM: Excel opens UTF-8 (Thai) correctly
  return new NextResponse(`﻿${body}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="utdsc-${name}-${stamp}.csv"`,
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}
