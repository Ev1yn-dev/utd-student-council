// The visitor's real IP, for rate limits, bans and IP hashes. utdsc.com is proxied by Cloudflare in front of Vercel,
// so x-forwarded-for / x-vercel-forwarded-for hold a CLOUDFLARE edge address (shared by everyone behind that edge) —
// keying limits on it made every visitor share one quota (the /auth/google 429s).
//
// cf-connecting-ip is trusted only when BOTH hold:
//   - the Host is utdsc.com / www.utdsc.com (the proxied domains), and
//   - the connection to Vercel came from a Cloudflare address (published ranges below),
// so nobody can send their own cf-connecting-ip straight to Vercel to dodge the limits.
// Otherwise: x-vercel-forwarded-for -> first x-forwarded-for -> x-real-ip. A Cloudflare address is never returned.
// Cloudflare ranges: https://www.cloudflare.com/ips/ (update if Cloudflare adds ranges).

export const PROXIED_HOSTS = ["utdsc.com", "www.utdsc.com"];

const CF_V4 = ["173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
  "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14",
  "172.64.0.0/13", "131.0.72.0/22"];
const CF_V6 = ["2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"];

const v4 = (ip: string) => {
  const p = ip.split(".");
  if (p.length !== 4 || p.some((x) => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
  return p.reduce((n, x) => n * 256 + Number(x), 0);
};
/** IPv6 as a 128-bit BigInt (handles "::" and an embedded IPv4 tail). */
export const v6 = (ip: string): bigint | null => {
  if (!ip.includes(":") || !/^[0-9a-f:.]+$/i.test(ip)) return null;
  let s = ip.toLowerCase();
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const n = v4(tail[1]);
    if (n === null) return null;
    s = s.slice(0, -tail[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  const groups = [...head, ...Array(fill).fill("0"), ...rest];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.reduce((n, g) => (n << BigInt(16)) + BigInt(parseInt(g, 16)), BigInt(0));
};

export const isIp = (ip: string) => v4(ip) !== null || v6(ip) !== null;

/** Whether ip is inside one of the ranges (IPv4 / IPv6, "a.b.c.d/n", "x::/n" or a single address). */
export function inRanges(ip: string, ranges: string[]) {
  const a = v4(ip);
  const b = a === null ? v6(ip) : null;
  if (a === null && b === null) return false;
  return ranges.some((c) => {
    const [base, bitsRaw] = c.trim().split("/");
    if (a !== null) {
      const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);
      const n = v4(base);
      if (n === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return ((a & mask) >>> 0) === ((n & mask) >>> 0);
    }
    const bits = bitsRaw === undefined ? 128 : Number(bitsRaw);
    const n = v6(base);
    if (n === null || !Number.isInteger(bits) || bits < 0 || bits > 128) return false;
    const shift = BigInt(128 - bits);
    return b! >> shift === n >> shift;
  });
}

export const isCloudflareIp = (ip: string) => inRanges(ip, ip.includes(":") ? CF_V6 : CF_V4);

type HeaderBag = { get(name: string): string | null };
const first = (v: string | null) => v?.split(",")[0]?.trim() || null;

/**
 * Visitor country (ISO 3166 alpha-2) or null. Behind Cloudflare, Vercel geolocates the Cloudflare edge, so the
 * Cloudflare header is used when the request really came through Cloudflare (same rule as clientIp).
 */
export function clientCountry(h: HeaderBag): string | null {
  const host = (h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const peer = first(h.get("x-vercel-forwarded-for")) ?? first(h.get("x-forwarded-for")) ?? h.get("x-real-ip")?.trim() ?? null;
  const viaCf = PROXIED_HOSTS.includes(host) && !!peer && isCloudflareIp(peer);
  const c = ((viaCf ? h.get("cf-ipcountry") : h.get("x-vercel-ip-country")) ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(c) && c !== "XX" && c !== "T1" ? c : null;
}

/** Real client IP, or "unknown" (never a Cloudflare edge address). */
export function clientIp(h: HeaderBag): string {
  const host = (h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const peer = first(h.get("x-vercel-forwarded-for")) ?? first(h.get("x-forwarded-for")) ?? h.get("x-real-ip")?.trim() ?? null;
  const cf = h.get("cf-connecting-ip")?.trim() ?? null;
  if (cf && isIp(cf) && PROXIED_HOSTS.includes(host) && peer && isCloudflareIp(peer)) return cf;
  for (const ip of [peer, first(h.get("x-forwarded-for")), h.get("x-real-ip")?.trim() ?? null]) {
    if (ip && isIp(ip) && !isCloudflareIp(ip)) return ip;
  }
  return "unknown";
}
