// Rate limit + admin bypass + real client IP. Run: npm run test:rl (Node >= 23 runs TypeScript directly).
// Uses the in-memory limiter (Upstash variables are cleared below), same rules as production.
import assert from "node:assert/strict";

process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
process.env.APP_SECRET = "test-secret-0123456789abcdef";
process.env.ADMIN_EMAILS = " Admin.One@gmail.com ";
const { issueBypass, verifyBypass, ipAllowlisted, RL_BYPASS_TTL_SEC } = await import("../lib/rl-bypass.ts");
const { clientIp, isCloudflareIp } = await import("../lib/client-ip.ts");
const { limit } = await import("../lib/ratelimit.ts");

// ── bypass cookie ──
const now = 1_800_000_000;
const good = issueBypass("ADMIN.ONE@gmail.com ", now)!;
assert.ok(good, "admin gets a cookie");
assert.equal(verifyBypass(good, now + 60), "admin.one@gmail.com", "valid cookie");
assert.equal(issueBypass("", now), null, "no address -> no cookie");
const [b64, exp, sig] = good.split(".");
const flip = (s: string) => s.slice(0, -1) + (s.at(-1) === "A" ? "B" : "A");
assert.equal(verifyBypass(`${b64}.${exp}.${flip(sig)}`, now), null, "forged signature");
assert.equal(verifyBypass(`${b64}.${Number(exp) + 3600}.${sig}`, now), null, "exp changed -> signature no longer matches");
assert.equal(verifyBypass(good, now + RL_BYPASS_TTL_SEC + 1), null, "expired");
const other = Buffer.from("someone@gmail.com").toString("base64url");
assert.equal(verifyBypass(`${other}.${exp}.${sig}`, now), null, "another address with an admin signature");
assert.equal(verifyBypass("garbage", now), null);
assert.equal(verifyBypass("", now), null);
// revocation (account disabled / removed) is checked against admin_users by proxy.ts when a limit is hit
process.env.APP_SECRET = "a-different-secret-xxxxxxxxxxxx";
assert.equal(verifyBypass(good, now + 60), null, "signed with another secret");
process.env.APP_SECRET = "test-secret-0123456789abcdef";
// ── RATE_LIMIT_ALLOW_IPS ──
const ALLOW = " 203.0.113.7, 198.51.100.0/24 ,2001:db8::/48, junk, 10.0.0.0/99 ";
for (const ip of ["203.0.113.7", "198.51.100.200", "2001:db8:0:ffff::1"]) assert.ok(ipAllowlisted(ip, ALLOW), ip);
for (const ip of ["203.0.113.8", "198.51.101.1", "2001:db9::1", "10.1.2.3", "unknown"]) assert.ok(!ipAllowlisted(ip, ALLOW), ip);
assert.ok(!ipAllowlisted("203.0.113.7", ""), "empty list");

// ── real client IP ──
const H = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
assert.ok(isCloudflareIp("172.70.1.2") && isCloudflareIp("2a06:98c0::1") && !isCloudflareIp("203.0.113.9"));
// through Cloudflare on utdsc.com: cf-connecting-ip
assert.equal(clientIp(H({ host: "utdsc.com", "cf-connecting-ip": "203.0.113.9", "x-vercel-forwarded-for": "172.70.1.2", "x-forwarded-for": "172.70.1.2" })), "203.0.113.9");
assert.equal(clientIp(H({ host: "www.utdsc.com", "cf-connecting-ip": "2001:db8::5", "x-vercel-forwarded-for": "2400:cb00::7" })), "2001:db8::5");
// forged cf-connecting-ip sent straight to Vercel (peer is not Cloudflare) -> ignored
assert.equal(clientIp(H({ host: "utdsc.com", "cf-connecting-ip": "198.51.100.1", "x-vercel-forwarded-for": "203.0.113.50" })), "203.0.113.50");
// other host (vercel.app) -> header ignored
assert.equal(clientIp(H({ host: "utd-student-council.vercel.app", "cf-connecting-ip": "198.51.100.1", "x-vercel-forwarded-for": "203.0.113.51" })), "203.0.113.51");
// never a Cloudflare address as the key
assert.equal(clientIp(H({ host: "utdsc.com", "x-vercel-forwarded-for": "172.70.1.2", "x-forwarded-for": "172.70.1.2" })), "unknown");
assert.equal(clientIp(H({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");

// ── /auth/google: 20 per 10 min per IP, other IPs unaffected ──
const a = [];
for (let i = 0; i < 25; i++) a.push((await limit("authStart", "203.0.113.10")).ok);
assert.equal(a.filter(Boolean).length, 20, "20 allowed");
assert.deepEqual(a.slice(20), [false, false, false, false, false], "21st..25th -> 429");
assert.equal((await limit("authStart", "203.0.113.11")).ok, true, "a second IP is not affected");
assert.equal((await limit("authCallback", "203.0.113.10")).ok, true, "callback has its own bucket");
let c = 0;
for (let i = 0; i < 45; i++) if ((await limit("authCallback", "203.0.113.12")).ok) c++;
assert.equal(c, 40, "callback: 40 per 10 min");

console.log("rate limit ok — bypass cookie (11 checks), client IP (7), auth quotas (start 20, callback 40, per IP)");
