import { Resolver } from "node:dns/promises";
import { v6 } from "./client-ip.ts";

// Trap (honeypot) sources and the automatic 24 h block (supabase/migrations/0023_trap_hits_and_ip_blocks.sql).
// Plain fetch over PostgREST (service role) so the proxy can use it. Only trap hits are recorded with the full IP.
//
// Blocked IPs are checked on EVERY request, so the list is kept in memory per instance and re-read from the DB at most
// once a minute (no DB call per request). A block made on this instance applies at once; on others within a minute.

const REFRESH_MS = 60_000;
let blocked = new Map<string, number>(); // ip -> expiry (ms), from public.ip_blocks
const local = new Map<string, number>(); // blocks made by this instance (kept until the next reads include them)
let loadedAt = 0;
let loading: Promise<void> | null = null;

function rest() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, headers: { apikey: key, authorization: `Bearer ${key}` } } : null;
}

async function loadBlocks() {
  const r = rest();
  try {
    if (!r) return;
    const now = new Date().toISOString();
    const res = await fetch(`${r.url}/rest/v1/ip_blocks?select=ip,expires_at&expires_at=gt.${encodeURIComponent(now)}`, {
      headers: r.headers, cache: "no-store", signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return;
    const rows = (await res.json()) as { ip: string; expires_at: string }[];
    blocked = new Map(rows.map((x) => [x.ip, Date.parse(x.expires_at)]));
    for (const [ip, until] of local) if (blocked.has(ip) || until < Date.now()) local.delete(ip);
  } catch {
    // fail open: an outage must not block anyone
  } finally {
    loadedAt = Date.now();
  }
}

/** Expiry (ms) of an active block for this IP, or null. Fails open. */
export async function blockedUntil(ip: string): Promise<number | null> {
  if (ip === "unknown") return null;
  if (Date.now() - loadedAt > REFRESH_MS) {
    loading ??= loadBlocks().finally(() => (loading = null));
    if (!loadedAt) await loading; // a fresh instance waits once; later refreshes run in the background
  }
  const until = blocked.get(ip) ?? local.get(ip);
  return until && until > Date.now() ? until : null;
}

/** Team Cymru IP-to-ASN DNS name for an IP (IPv4 or IPv6), or null. */
export function cymruOrigin(ip: string): string | null {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) return `${ip.split(".").reverse().join(".")}.origin.asn.cymru.com`;
  const n = v6(ip);
  if (n === null) return null;
  return `${n.toString(16).padStart(32, "0").split("").reverse().join(".")}.origin6.asn.cymru.com`;
}

const resolver = new Resolver({ timeout: 1500, tries: 1 });
const nets = new Map<string, { asn: number; org: string | null } | null>();
const firstTxt = async (name: string) => (await resolver.resolveTxt(name)).map((r) => r.join(""))[0] ?? "";

/**
 * The network an IP belongs to (ASN + name) from Team Cymru's DNS service: "15169 | 8.8.8.0/24 | US | arin | ..." then
 * "15169 | US | arin | 2000-03-30 | GOOGLE - Google LLC, US". Vercel has no request.cf (that is Cloudflare Workers
 * only) and Cloudflare sends no ASN header, so this is looked up here — only for trap hits, cached per instance.
 */
async function network(ip: string) {
  if (nets.has(ip)) return nets.get(ip)!;
  let out: { asn: number; org: string | null } | null = null;
  try {
    const name = cymruOrigin(ip);
    const asn = name ? Number((await firstTxt(name)).split("|")[0]?.trim().split(/\s+/)[0]) : NaN;
    if (Number.isInteger(asn) && asn > 0) {
      const org = (await firstTxt(`AS${asn}.asn.cymru.com`)).split("|")[4]?.trim() || null;
      out = { asn, org: org?.slice(0, 200) ?? null };
    }
  } catch {
    // unknown network: the hit is still recorded
  }
  if (nets.size > 5000) nets.clear();
  nets.set(ip, out);
  return out;
}

/**
 * Records a trap hit (full IP, country, network, user agent, path). Returns the block's expiry (ms) when this IP is
 * now blocked (3+ hits in 10 minutes -> 24 h), else null. Never throws.
 */
export async function recordTrapHit(e: { ip: string; country: string | null; ua: string; path: string }): Promise<number | null> {
  const r = rest();
  if (!r || e.ip === "unknown") return null;
  const net = await network(e.ip);
  try {
    const res = await fetch(`${r.url}/rest/v1/rpc/record_trap_hit`, {
      method: "POST",
      headers: { ...r.headers, "content-type": "application/json" },
      body: JSON.stringify({ p_ip: e.ip, p_country: e.country, p_asn: net?.asn ?? null, p_as_org: net?.org ?? null, p_ua: e.ua.slice(0, 400), p_path: e.path.slice(0, 300) }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      console.error(`[security] record_trap_hit ${res.status}`);
      return null;
    }
    const until = (await res.json()) as string | null;
    if (!until) return null;
    const ms = Date.parse(until);
    local.set(e.ip, ms);
    return ms;
  } catch {
    return null;
  }
}
