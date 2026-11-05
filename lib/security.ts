import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { clientIp as realClientIp } from "@/lib/client-ip";

function secret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") throw new Error("APP_SECRET (>=16 chars) is required in production");
  return "dev-only-secret-change-me";
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

/** Short-lived HMAC token handed out by /api/token; required by data APIs. */
export function issueToken(ttlSeconds = 300) {
  const payload = b64(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + ttlSeconds, n: b64(createHash("sha256").update(String(Math.random())).digest().subarray(0, 8)) }));
  return { token: `${payload}.${sign(payload)}`, expiresIn: ttlSeconds };
}

export function verifyToken(token: string | null | undefined) {
  if (!token) return false;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return false;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

/** Only the hash is stored — never the raw IP. */
export function hashIp(ip: string) {
  return createHash("sha256").update(ip + secret()).digest("hex").slice(0, 32);
}

/**
 * Keyed hash of IP + user agent for the visit counter. The database salts it again with a random salt that is deleted
 * after the day, so the stored value cannot be traced back to an IP. The raw IP never leaves this process.
 */
export function visitorIdent(ip: string, ua: string) {
  return createHmac("sha256", secret()).update(`visit|${ip}|${ua}`).digest("base64url");
}

/** HMAC of a student ID (server secret): the per-day limit key. Never stored next to a message. */
export function studentHash(studentId: string) {
  return createHmac("sha256", secret()).update(`student|${studentId}`).digest("base64url");
}

/** HMAC of student ID + message text, for the duplicate check. */
export function voiceMessageHash(studentId: string, message: string) {
  return createHmac("sha256", secret()).update(`voice|${studentId}|${message.replace(/\s+/g, " ").trim().toLowerCase()}`).digest("base64url");
}

/** Request must originate from our own pages (Origin or Referer host == Host). */
export function isSameOrigin(req: Request) {
  const host = req.headers.get("host");
  const from = req.headers.get("origin") ?? req.headers.get("referer");
  if (!host || !from) return false;
  try {
    return new URL(from).host === host;
  } catch {
    return false;
  }
}

/** Visitor IP (lib/client-ip.ts: Cloudflare-aware, never a Cloudflare edge address). */
export function clientIp(headers: Headers) {
  return realClientIp(headers);
}
