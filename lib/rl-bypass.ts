import { createHmac, timingSafeEqual } from "node:crypto";
import { inRanges, isIp } from "./client-ip.ts";
import { adminEmails, normalizeEmail } from "./env.ts"; // relative + extension: also loaded by plain Node in scripts/test-rate-limit.mts

// Rate-limit bypass for administrators (ADMIN_EMAILS only). Issued by /auth/callback, or by the proxy on a back-office
// page, only AFTER Supabase verified the session and the address matched ADMIN_EMAILS — never from anything the
// browser claims. Cookie value: base64url(email).exp.HMAC-SHA256(APP_SECRET, "email|exp"); httpOnly, Secure,
// SameSite=Lax, 12 h, path "/". It skips only the app's own rate limits, on every path (back office, /auth, /api,
// the voice form); bot blocks, bans, the browser gate, CSP, Turnstile and Cloudflare stay in force. The address is
// re-checked against ADMIN_EMAILS on every use, so removing it from the env var revokes the cookie at once.
//
// Second bypass: RATE_LIMIT_ALLOW_IPS (comma-separated IPv4 / IPv6 addresses or CIDR ranges), matched against the
// real client IP from lib/client-ip.ts (cf-connecting-ip only when the request really came through Cloudflare).

export const RL_BYPASS_COOKIE = "rl_bypass";
export const RL_BYPASS_TTL_SEC = 12 * 3600;
/** Paths of cookies issued before the bypass covered the whole site; cleared on sign-out. */
export const RL_BYPASS_OLD_PATHS = ["/auth", "/th/admin", "/en/admin"];

/** Cookie options (path "/"); maxAge 0 clears it. */
export const rlBypassCookie = (value: string, maxAge = RL_BYPASS_TTL_SEC, path = "/") =>
  ({ name: RL_BYPASS_COOKIE, value, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path, maxAge });

/** RATE_LIMIT_ALLOW_IPS as a list of ranges (invalid entries are dropped). */
export function allowedIpRanges(raw = process.env.RATE_LIMIT_ALLOW_IPS) {
  return (raw ?? "").split(",").map((x) => x.trim()).filter((x) => {
    const [base, bits, extra] = x.split("/");
    return extra === undefined && isIp(base) && (bits === undefined || /^\d{1,3}$/.test(bits));
  });
}

/** Whether the real client IP (lib/client-ip.ts) is in RATE_LIMIT_ALLOW_IPS. */
export const ipAllowlisted = (ip: string, raw?: string) => ip !== "unknown" && inRanges(ip, allowedIpRanges(raw));

function secret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 16) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-secret-change-me";
}
const mac = (key: string, data: string) => createHmac("sha256", key).update(data).digest("base64url");

/** Cookie value for a verified admin address, or null if the address is not in ADMIN_EMAILS (or no secret). */
export function issueBypass(email: string, nowSec = Math.floor(Date.now() / 1000)) {
  const key = secret();
  const e = normalizeEmail(email);
  if (!key || !adminEmails().includes(e)) return null;
  const exp = nowSec + RL_BYPASS_TTL_SEC;
  return `${Buffer.from(e).toString("base64url")}.${exp}.${mac(key, `${e}|${exp}`)}`;
}

/** The admin address a cookie value proves, or null (bad signature, expired, malformed, or no longer an admin). */
export function verifyBypass(value: string | null | undefined, nowSec = Math.floor(Date.now() / 1000)): string | null {
  const key = secret();
  if (!key || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [b64, expRaw, sig] = parts;
  if (!/^\d{1,12}$/.test(expRaw)) return null;
  const exp = Number(expRaw);
  if (exp <= nowSec || exp > nowSec + RL_BYPASS_TTL_SEC) return null;
  let email: string;
  try {
    email = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const want = Buffer.from(mac(key, `${email}|${exp}`));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  // exact (lower-case) match with the current list — no wildcard, no domain match
  return adminEmails().includes(normalizeEmail(email)) && email === normalizeEmail(email) ? email : null;
}
