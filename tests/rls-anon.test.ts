import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Regression for the 2026-11-12 pentest (migration 0024): with ONLY the public anon key, the Supabase REST API must
// not return any sensitive table, and must not return internal photo columns. Runs against the live project; skipped
// when the anon key / URL are not available (so CI without secrets stays green).

function env(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(new URL("../.env.local", import.meta.url), "utf8")
        .split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
        .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
    );
  } catch {
    return process.env as Record<string, string>;
  }
}
const e = env();
const URL_ = e.NEXT_PUBLIC_SUPABASE_URL;
const KEY = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, authorization: `Bearer ${KEY}` };
const get = (path: string) => fetch(`${URL_}/rest/v1/${path}`, { headers: H });

// Tables that hold student data, identities, admin data, or monitoring — anon must be refused outright.
const SENSITIVE = [
  "members", "advisors", "voice_messages", "voice_replies", "student_roster", "admin_users", "admin_audit",
  "audit_logs", "profiles", "role_invites", "allowed_users", "security_events", "trap_hits", "ip_blocks",
  "visit_stats", "visit_uniques", "visit_salts", "voice_quota", "voice_blocks", "voice_bad_words",
];

describe.skipIf(!URL_ || !KEY)("anon REST is locked down (pentest 0024)", () => {
  it.each(SENSITIVE)("anon cannot read public.%s", async (table) => {
    const r = await get(`${table}?select=*&limit=1`);
    expect(r.status, `${table} must deny anon`).toBe(401);
  });

  it("anon cannot read sensitive member columns", async () => {
    expect((await get("members?select=id,contact,instagram&limit=1")).status).toBe(401);
  });

  it("anon cannot read voice identities", async () => {
    expect((await get("voice_messages?select=student_id,sender_first_name,message&limit=1")).status).toBe(401);
  });

  it("anon cannot read internal photo columns", async () => {
    expect((await get("photos?select=uploaded_by,reviewed_by,reason&limit=1")).status).toBe(401);
  });

  it("anon CAN still read the public columns the site needs", async () => {
    expect((await get("academic_years?select=year,is_current&limit=1")).status).toBe(200);
    expect((await get("photos?select=id,width,height,blur,sort_order,is_hero&limit=1")).status).toBe(200);
  });
});
