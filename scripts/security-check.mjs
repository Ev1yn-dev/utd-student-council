// npm run security:check — every security check in one command. Exit 1 if any fails.
//   1. database: RLS enabled on every public table; storage "pending" bucket private and WebP-only
//      (needs SUPABASE_ACCESS_TOKEN; skipped with a warning without it)
//   2. anon key (what any visitor has): pending/hidden rows -> 0, private tables -> 0, inserts refused,
//      private storage not listable/readable
//   3. build + Playwright e2e/security.spec.ts: headers (curl -I), unauthenticated write -> 401, council cannot open
//      another's row, <script> shown as text, .html renamed .jpg rejected (browser and server)
//   4. secret scan of the browser bundle (.next/static)
//   5. npm audit: production dependencies, high/critical -> fail; dev-only findings are listed
// Options: --no-e2e (skip 3, e.g. quick DB check), --no-build (reuse the existing build)
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const env = {
  ...Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])),
  ...process.env,
};
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const shell = process.platform === "win32";
const results = [];
const check = (name, ok, info = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`); };

const CONTENT = ["announcements", "activities", "policies", "members", "advisors", "photos"];
const PRIVATE = ["profiles", "admin_users", "admin_audit", "allowed_users", "role_invites", "audit_logs", "security_events", "voice_messages", "voice_replies"];

async function rest(path, key, init = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", ...init.headers } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

// ── 1. database settings ──
const ref = URL_?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (env.SUPABASE_ACCESS_TOKEN && ref) {
  const sql = async (query) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST", headers: { authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ query }),
    });
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  const noRls = await sql("select c.relname from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity");
  check("RLS enabled on every public table", noRls.length === 0, noRls.map((r) => r.relname).join(", "));
  const [b] = await sql("select public, allowed_mime_types from storage.buckets where id = 'pending'");
  check("storage 'pending' bucket private + WebP/AVIF only", b && !b.public && JSON.stringify(b.allowed_mime_types) === '["image/webp","image/avif"]', JSON.stringify(b));
} else {
  console.log("SKIP  RLS / bucket settings (no SUPABASE_ACCESS_TOKEN in .env.local)");
}

// ── 2. anon key ──
// one pending row of our own so "anon sees 0" is meaningful
const seed = await rest("announcements", SERVICE, { method: "POST", headers: { prefer: "return=representation" },
  body: JSON.stringify({ title: "[SECURITY-CHECK] pending", published_on: new Date().toISOString().slice(0, 10), status: "pending" }) });
const seedId = seed.body?.[0]?.id;
try {
  for (const t of CONTENT) {
    const svc = await rest(`${t}?select=id&status=neq.approved`, SERVICE);
    const anon = await rest(`${t}?select=id&status=neq.approved`, ANON);
    check(`anon reads unapproved ${t} -> 0 rows`, Array.isArray(anon.body) && anon.body.length === 0, `server has ${svc.body?.length ?? "?"}`);
  }
  for (const t of PRIVATE) {
    const anon = await rest(`${t}?select=*&limit=1`, ANON);
    check(`anon reads ${t} -> nothing`, !Array.isArray(anon.body) || anon.body.length === 0, `HTTP ${anon.status}`);
  }
  const ins = await rest("announcements", ANON, { method: "POST", body: JSON.stringify({ title: "[SECURITY-CHECK] anon insert", published_on: "2026-01-01", status: "approved" }) });
  check("anon insert refused", ins.status === 401 || ins.status === 403, `HTTP ${ins.status}`);
  const upd = await rest(`announcements?id=eq.${seedId}`, ANON, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ status: "approved" }) });
  check("anon cannot approve a row", !Array.isArray(upd.body) || upd.body.length === 0, `HTTP ${upd.status}`);
  const list = await fetch(`${URL_}/storage/v1/object/list/pending`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${ANON}`, "content-type": "application/json" }, body: JSON.stringify({ prefix: "", limit: 5 }) });
  const listed = await list.json().catch(() => []);
  check("anon lists private storage -> nothing", !Array.isArray(listed) || listed.length === 0, `HTTP ${list.status}`);
  const pub = await fetch(`${URL_}/storage/v1/object/public/pending/x.webp`);
  check("private bucket has no public URL", pub.status >= 400, `HTTP ${pub.status}`);
} finally {
  if (seedId) await rest(`announcements?id=eq.${seedId}`, SERVICE, { method: "DELETE" });
}

// ── 3. app checks (Playwright) ──
if (!process.argv.includes("--no-e2e")) {
  const args = ["scripts/e2e.mjs", ...(process.argv.includes("--no-build") ? ["--no-build"] : []), "e2e/security.spec.ts"];
  const r = spawnSync("node", args, { stdio: "inherit", shell });
  check("app security tests (e2e/security.spec.ts)", r.status === 0);
}

// ── 4. secrets in the browser bundle ──
check("no secret in .next/static", spawnSync("node", ["scripts/secret-scan.mjs", "--build"], { stdio: "inherit", shell }).status === 0);

// ── 5. dependencies ──
const prod = spawnSync("npm", ["audit", "--omit=dev", "--audit-level=high"], { encoding: "utf8", shell });
check("npm audit (production deps, high/critical)", prod.status === 0, prod.stdout.trim().split("\n").pop());
const all = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", shell });
try {
  const v = Object.entries(JSON.parse(all.stdout).vulnerabilities ?? {}).filter(([, x]) => ["high", "critical"].includes(x.severity));
  if (v.length) console.log(`INFO  dev-only advisories (not shipped): ${v.map(([n]) => n).join(", ")} — see SECURITY.md`);
} catch { /* ignore */ }

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
