import { createHmac, timingSafeEqual } from "node:crypto";
import { BLOCKED_TOOLS } from "./bots.ts";
import { CHANNELS } from "./contact.ts";
import { DECOY_TEXT } from "./decoy-text.ts";

// Anti-code-fetching gate (proxy.ts runs it on every request except favicon.ico, robots.txt and sitemap.xml).
//
// Pages: served only to a real top-level browser navigation (Sec-Fetch-Mode navigate + Sec-Fetch-Dest document +
//   Accept text/html + Accept-Language + a browser User-Agent without automation/tool markers), to the app's own
//   in-page RSC fetches, and to verified search / link-preview bots. In-app browsers (LINE / Instagram / Facebook /
//   Discord web views) that send no Sec-Fetch-* headers: Accept text/html + Accept-Language + a phone browser UA.
// Bypass: PROTECTION_MODE=off, or the owner's ?dev=<DEV_BYPASS_SECRET> cookie (1 h) — source maps are refused anyway.
// Assets (/_next/static, /_next/image, public files) and /api: need the signed cookie. The browser gets it from
//   components/layout/BrowserCheck.tsx (JS on, navigator.webdriver false) through POST /api/gate. Before that cookie
//   exists, the browser's own subresource requests for the first page view (same-origin script/style/font/image)
//   are let through; a bare request for a file (curl, a "view source" site) is not.
// Extension contexts (chrome-extension:// etc. Origin/Referer, Sec-Fetch-Site none on a non-navigation, an HTML
//   document fetched with cors/no-cors) and source maps always get the message.
// Everything refused gets 403 with DECOY_TEXT (HTML page for HTML clients, text/plain otherwise).

export { DECOY_TEXT };
export const GATE_COOKIE = "utd_b";
export const GATE_TTL_SEC = 12 * 3600;

/** Link-preview / social bots, allowed by User-Agent (no published reverse-DNS to check). */
const PREVIEW_BOTS =
  /facebookexternalhit|facebot|meta-externalfetcher|twitterbot|discordbot|linkedinbot|slackbot|telegrambot|whatsapp|line-poker|linespider|\bline\/|skypeuripreview|pinterestbot/i;
/** Search engines checked by reverse + forward DNS in lib/bots.ts (verifySearchBot). */
export const DNS_VERIFIED_BOTS = /googlebot|google-favicon|google-inspectiontool|googleother|storebot-google|adsbot-google|apis-google|feedfetcher-google|google-site-verification|chrome-lighthouse|bingbot|bingpreview|msnbot|adidxbot|applebot(?!-extended)|duckduckbot/i;
/** Platform health checks / screenshots. */
const HEALTH = /cloudflare-(healthchecks|traffic-manager|diagnostics)|vercel-(screenshot|favicon)|vercelbot/i;

/** Headless / automation / HTTP-library markers that a real browser never sends. */
const AUTOMATION = /headless|phantomjs|puppeteer|playwright|selenium|webdriver|electron|lighthouse|pagespeed|cypress|python|java\/|curl|wget|go-http-client|axios|node-fetch|undici|httpx|okhttp|libwww|scrapy|postman|insomnia|httpie/i;
const BROWSER_UA = /^Mozilla\/5\.0 \(.+\) .*(Chrome|CriOS|Firefox|FxiOS|Safari|Edg)\//;
/** Phone web views: iOS in-app browsers (Instagram, Facebook, LINE...) carry no "Safari/" token, only "Mobile/<build>". */
const MOBILE_WEBVIEW = /^Mozilla\/5\.0 \((?:iPhone|iPad|iPod|Linux; Android)[^)]*\) AppleWebKit\/[\d.]+ \(KHTML, like Gecko\)/;
const IN_APP = /\bLine\/|Instagram|FBAN|FBAV|FB_IAB|FBIOS|Discord|KAKAOTALK|Twitter|TikTok|musical_ly|BytedanceWebview|MicroMessenger|\bMobile\/[0-9A-Z]+/;
const MOBILE = /iPhone|iPad|iPod|Android/;
const EXTENSION = /^(chrome|moz|safari-web|ms-browser|edge)-extension:\/\//i;

function secret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 16) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-secret-change-me";
}
const mac = (key: string, data: string) => createHmac("sha256", key).update(`gate|${data}`).digest("base64url").slice(0, 22);

export function issueGateCookie(nowSec = Math.floor(Date.now() / 1000)) {
  const key = secret();
  if (!key) return null;
  const exp = nowSec + GATE_TTL_SEC;
  return { name: GATE_COOKIE, value: `${exp}.${mac(key, String(exp))}`, maxAge: GATE_TTL_SEC };
}

export function validGateCookie(value: string | undefined, nowSec = Math.floor(Date.now() / 1000)) {
  const key = secret();
  if (!key || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < nowSec || Number(exp) > nowSec + GATE_TTL_SEC) return false;
  const want = Buffer.from(mac(key, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

type HeaderBag = { get(name: string): string | null };

export type PathKind = "page" | "asset" | "api" | "open";

/** What a path is, for the gate. "open" = never gated (sign-in callbacks, the gate and cron endpoints). */
export function pathKind(pathname: string): PathKind {
  if (/^\/auth(\/|$)/.test(pathname) || pathname === "/api/gate" || pathname.startsWith("/api/cron/")) return "open";
  if (pathname.startsWith("/api/")) return "api";
  if (pathname.startsWith("/_next/") || /\.[a-z0-9]{2,5}$/i.test(pathname)) return "asset";
  return "page";
}

export const isBrowserUa = (ua: string) =>
  (BROWSER_UA.test(ua) || (MOBILE_WEBVIEW.test(ua) && IN_APP.test(ua))) && !AUTOMATION.test(ua) && !BLOCKED_TOOLS.test(ua);

/** Bot class of a User-Agent: "dns" must still pass the DNS check, "ua" is allowed as is. */
export function botClass(ua: string): "dns" | "ua" | null {
  if (DNS_VERIFIED_BOTS.test(ua)) return "dns";
  if (PREVIEW_BOTS.test(ua) || HEALTH.test(ua)) return "ua";
  return null;
}

/**
 * Lighthouse audits (scripts/lighthouse.mjs): x-lighthouse-token = "exp.HMAC-SHA256(LIGHTHOUSE_TOKEN, 'lighthouse|exp')",
 * valid for at most 15 min. LIGHTHOUSE_TOKEN is a server-only secret (unset = never valid); no User-Agent is trusted.
 */
export function validLighthouseToken(value: string | null, nowSec = Math.floor(Date.now() / 1000)) {
  const key = process.env.LIGHTHOUSE_TOKEN;
  if (!key || key.length < 32 || !value) return false;
  const [expRaw, sig, extra] = value.split(".");
  if (extra !== undefined || !/^\d{1,12}$/.test(expRaw ?? "") || !sig) return false;
  const exp = Number(expRaw);
  if (exp <= nowSec || exp > nowSec + 900) return false;
  const want = Buffer.from(createHmac("sha256", key).update(`lighthouse|${exp}`).digest("base64url"));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/**
 * PROTECTION_MODE: "strict" (default) = this gate + all browser-side blocking (components/layout/Protect.tsx);
 * "relaxed" = this gate + copy / shortcut / print blocking, no DevTools detection; "off" = no gate (source maps
 * still refused) and no browser-side blocking.
 */
export type ProtectionMode = "strict" | "relaxed" | "off";
export function protectionMode(raw = process.env.PROTECTION_MODE): ProtectionMode {
  const v = raw?.trim().toLowerCase();
  return v === "off" || v === "relaxed" ? v : "strict";
}

/** ?dev=<DEV_BYPASS_SECRET> -> a 1 h HttpOnly cookie that skips the gate and the browser-side blocking (the owner). */
export const DEV_COOKIE = "utd_dev";
export const DEV_TTL_SEC = 3600;
/** Readable hint "this browser may skip the blocking" (admin / dev cookie); it only makes the page ask /api/gate again. */
export const NO_PROTECT_HINT = "utd_np";
const devSecret = () => {
  const s = process.env.DEV_BYPASS_SECRET;
  return s && s.length >= 24 ? s : null;
};
export function validDevSecret(value: string | null) {
  const s = devSecret();
  if (!s || !value) return false;
  const a = createHmac("sha256", "dev-param").update(value).digest();
  const b = createHmac("sha256", "dev-param").update(s).digest();
  return timingSafeEqual(a, b);
}
export function issueDevCookie(nowSec = Math.floor(Date.now() / 1000)) {
  const s = devSecret();
  if (!s) return null;
  const exp = nowSec + DEV_TTL_SEC;
  return `${exp}.${createHmac("sha256", s).update(`dev|${exp}`).digest("base64url")}`;
}
export function validDevCookie(value: string | undefined, nowSec = Math.floor(Date.now() / 1000)) {
  const s = devSecret();
  if (!s || !value) return false;
  const [exp, sig, extra] = value.split(".");
  if (extra !== undefined || !/^\d{1,12}$/.test(exp ?? "") || !sig) return false;
  if (Number(exp) <= nowSec || Number(exp) > nowSec + DEV_TTL_SEC) return false;
  const want = Buffer.from(createHmac("sha256", s).update(`dev|${exp}`).digest("base64url"));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

/**
 * The decision for one request. `botOk` = the User-Agent is an allowed bot (already DNS-verified when needed).
 * `bypass` = PROTECTION_MODE=off or the owner's dev cookie: everything passes except source maps.
 */
export function gate(h: HeaderBag, method: string, pathname: string, cookie: string | undefined, botOk: boolean, bypass = false): "pass" | "decoy" {
  const kind = pathKind(pathname);
  if (/\.map$/i.test(pathname)) return "decoy"; // source maps: never
  if (bypass) return "pass";
  if (validLighthouseToken(h.get("x-lighthouse-token"))) return "pass"; // a signed audit run, never by User-Agent
  if (kind === "open") return "pass";

  const origin = h.get("origin") ?? "";
  const referer = h.get("referer") ?? "";
  if (EXTENSION.test(origin) || EXTENSION.test(referer)) return "decoy";
  const mode = h.get("sec-fetch-mode");
  const dest = h.get("sec-fetch-dest");
  const site = h.get("sec-fetch-site");
  if (site === "none" && mode !== "navigate") return "decoy"; // a fetch from an extension / devtools context

  if (botOk && kind !== "api") return "pass";

  const ua = h.get("user-agent") ?? "";
  const accept = h.get("accept") ?? "";
  const language = !!h.get("accept-language");
  const navigation = mode === "navigate" && dest === "document" && accept.includes("text/html") && language && isBrowserUa(ua);
  // older in-app browsers (LINE / Instagram / Facebook / Discord web views) send no Sec-Fetch-* headers at all
  const noFetchMeta = !mode && !dest && !site;
  const phone = noFetchMeta && MOBILE.test(ua) && isBrowserUa(ua);
  const inAppNavigation = phone && accept.includes("text/html") && language;
  const self = h.get("host") ?? "";
  const fromSelf = (v: string) => !!self && hostOf(v) === self;
  const cookieOk = validGateCookie(cookie);
  const htmlByFetch = (mode === "cors" || mode === "no-cors") && accept.includes("text/html");

  if (kind === "page") {
    // writes (Server Actions) are checked by Next.js (Origin) and the actions themselves
    if (method !== "GET" && method !== "HEAD") return site === "same-origin" || cookieOk || (phone && fromSelf(origin)) ? "pass" : "decoy";
    if (navigation || inAppNavigation) return "pass";
    if (htmlByFetch) return "decoy";
    // the app's own RSC fetches / prefetches from one of its pages
    if (site === "same-origin" && (mode === "cors" || mode === "same-origin") && isBrowserUa(ua)) return "pass";
    return "decoy";
  }
  if (!isBrowserUa(ua)) return "decoy";
  if (cookieOk && !htmlByFetch) return "pass";
  if (kind === "asset") {
    // the browser's own subresource requests for the first page view (before the cookie exists)
    if (site === "same-origin" && ["script", "style", "font", "image", "manifest", "empty", "worker"].includes(dest ?? "")) return "pass";
    // an image / file opened directly in a tab
    if (navigation || (mode === "navigate" && site !== "none" && isBrowserUa(ua))) return "pass";
    // an in-app browser without Sec-Fetch-*: its page's own files (Referer = this site)
    if (phone && fromSelf(referer)) return "pass";
  }
  return "decoy";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The 403 body: an HTML page for clients that render HTML, plain text otherwise. */
export function decoyBody(accept: string | null): { body: string; type: string } {
  if (!accept?.includes("text/html")) return { body: `${DECOY_TEXT}\n`, type: "text/plain; charset=utf-8" };
  const fb = CHANNELS.find((c) => c.key === "facebook") ?? CHANNELS[0];
  return {
    type: "text/html; charset=utf-8",
    body: `<!-- ${DECOY_TEXT} -->
<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>สภานักเรียนโรงเรียนอุตรดิตถ์</title>
<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;padding:16px;box-sizing:border-box;background:#f7f8fc;color:#111a33;font:16px/1.7 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}main{max-width:32rem;text-align:center;background:#fff;border:1px solid #e6eaf2;border-radius:20px;padding:32px 24px;box-shadow:0 8px 28px -6px rgb(11 31 77/.1)}p{margin:0 0 20px;font-size:1.15rem;font-weight:600;color:#0b1f4d}a{display:inline-block;padding:10px 20px;border-radius:999px;background:#0b1f4d;color:#f5f7ff;text-decoration:none}a:hover{background:#c2185b}</style>
</head><body><main><p>${esc(DECOY_TEXT)}</p><a href="${esc(fb.href)}" rel="noopener noreferrer">${esc(fb.label)}</a></main></body></html>
`,
  };
}
