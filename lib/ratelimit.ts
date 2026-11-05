import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type Bucket = "page" | "api" | "form" | "login" | "upload" | "authStart" | "authCallback";

const RULES: Record<Bucket, { max: number; windowSec: number }> = {
  page: { max: 60, windowSec: 60 }, // 60 req/min
  api: { max: 20, windowSec: 60 }, // 20 req/min
  form: { max: 10, windowSec: 3600 }, // 10 per hour per IP (/voice); plus 3 per student ID per day (voice_claim)
  login: { max: 5, windowSec: 900 }, // 5 per 15 min (password-style login forms; not used by the Google flow)
  // Google sign-in, per real client IP (lib/client-ip.ts), sliding window, own key prefix (utd:authStart / utd:authCallback)
  authStart: { max: 20, windowSec: 600 }, // GET /auth/google: 20 / 10 min
  authCallback: { max: 40, windowSec: 600 }, // /auth/callback and the rest of /auth/*: 40 / 10 min
  upload: { max: 60, windowSec: 600 }, // 60 photos / 10 min per signed-in user (back office)
};

const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const upstash = hasUpstash
  ? Object.fromEntries(
      (Object.keys(RULES) as Bucket[]).map((b) => [
        b,
        new Ratelimit({
          redis: Redis.fromEnv(),
          limiter: Ratelimit.slidingWindow(RULES[b].max, `${RULES[b].windowSec} s`),
          prefix: `utd:${b}`,
        }),
      ]),
    )
  : null;

// In-memory fallback (dev / single instance). Not shared across serverless instances — use Upstash in production.
const hits = new Map<string, number[]>();
const banned = new Map<string, number>();

/** Sign-in buckets fail open: an Upstash outage must not lock everyone out of signing in (logged instead). */
const FAIL_OPEN: Bucket[] = ["authStart", "authCallback"];

export async function limit(bucket: Bucket, key: string): Promise<{ ok: boolean; retryAfter: number }> {
  const rule = RULES[bucket];
  if (upstash) {
    try {
      const r = await (upstash as Record<Bucket, Ratelimit>)[bucket].limit(key);
      return { ok: r.success, retryAfter: Math.max(1, Math.ceil((r.reset - Date.now()) / 1000)) };
    } catch (err) {
      if (!FAIL_OPEN.includes(bucket)) throw err;
      console.error(`[ratelimit] ${bucket} limiter unavailable — allowing (fail-open)`, (err as Error).message);
      return { ok: true, retryAfter: 0 };
    }
  }
  const now = Date.now();
  const k = `${bucket}:${key}`;
  const arr = (hits.get(k) ?? []).filter((t) => now - t < rule.windowSec * 1000);
  if (arr.length >= rule.max) {
    hits.set(k, arr);
    return { ok: false, retryAfter: Math.ceil((arr[0] + rule.windowSec * 1000 - now) / 1000) };
  }
  arr.push(now);
  hits.set(k, arr);
  if (hits.size > 5000) for (const [kk, v] of hits) if (now - v[v.length - 1] > 600_000) hits.delete(kk);
  return { ok: true, retryAfter: 0 };
}

const BAN_MS = 60 * 60 * 1000;

export async function ban(ip: string) {
  if (hasUpstash) await Redis.fromEnv().set(`utd:ban:${ip}`, 1, { ex: BAN_MS / 1000 });
  else banned.set(ip, Date.now() + BAN_MS);
}

export async function isBanned(ip: string) {
  if (hasUpstash) return (await Redis.fromEnv().get(`utd:ban:${ip}`)) !== null;
  const until = banned.get(ip);
  if (!until) return false;
  if (until < Date.now()) { banned.delete(ip); return false; }
  return true;
}
