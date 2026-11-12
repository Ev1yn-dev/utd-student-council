import { createHash } from "node:crypto";

// Security monitoring: writes to public.security_events (service role, RLS-hidden) and to the server log.
// Plain fetch (no supabase-js) so the proxy can use it too. Never throws, never blocks the response for long,
// and the same (kind, ip) is recorded at most once a minute per instance so a flood cannot flood the table.

export type SecurityKind =
  | "trap" | "ua_blocked" | "fake_bot" | "rate_limited" | "unauth_write"
  | "forbidden" | "upload_rejected" | "login" | "logout_all" | "error" | "dev_bypass" | "ip_blocked";

const recent = new Map<string, number>();

export function hashIp(ip: string) {
  return createHash("sha256").update(ip + (process.env.APP_SECRET ?? "dev")).digest("hex").slice(0, 32);
}

export async function logSecurity(kind: SecurityKind, e: { ip?: string; userId?: string; path?: string; detail?: Record<string, unknown> } = {}) {
  const ipHash = e.ip ? hashIp(e.ip) : null;
  console.warn(`[security] ${kind}${e.path ? ` path=${e.path}` : ""}${ipHash ? ` ip#=${ipHash.slice(0, 8)}` : ""}${e.detail ? ` ${JSON.stringify(e.detail).slice(0, 200)}` : ""}`);
  const k = `${kind}:${ipHash ?? e.userId ?? ""}`;
  const now = Date.now();
  if ((recent.get(k) ?? 0) > now - 60_000) return;
  recent.set(k, now);
  if (recent.size > 5000) recent.clear();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/security_events`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({ kind, ip_hash: ipHash, user_id: e.userId ?? null, path: e.path?.slice(0, 300) ?? null, detail: e.detail ?? {} }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // monitoring must never break the request
  }
}

const bypassSeen = new Map<string, number>();
/**
 * Audit row when an administrator's rl_bypass cookie let a request through that the rate limit would have blocked.
 * At most one row per (address, rule) per minute per instance.
 */
export async function auditBypass(email: string, e: { ip: string; path: string; rule: string }) {
  const k = `${email}:${e.rule}`;
  const now = Date.now();
  if ((bypassSeen.get(k) ?? 0) > now - 60_000) return;
  bypassSeen.set(k, now);
  console.warn(`[security] rl_bypass used rule=${e.rule} path=${e.path} ip#=${hashIp(e.ip).slice(0, 8)}`);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/rest/v1/audit_logs`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json", prefer: "return=minimal" },
      body: JSON.stringify({ actor_email: email, action: "rl_bypass:used", target_table: null, target_id: e.path.slice(0, 200), detail: { rule: e.rule, ip_hash: hashIp(e.ip) } }),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    // monitoring must never break the request
  }
}
