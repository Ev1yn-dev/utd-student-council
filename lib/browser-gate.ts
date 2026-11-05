import { createHmac, timingSafeEqual } from "node:crypto";
import { CHANNELS } from "./contact.ts";

// Anti-code-fetching gate for page requests (proxy.ts). Real browsers, search engines and link-preview bots get the
// site; anything else (curl, wget, scripts, "view source" services, headless tools) gets a small decoy page (403).
// No loading gate: a browser navigation is recognised from headers browsers set themselves (Sec-Fetch-*), answered at
// once, and given a short signed cookie so its later in-app requests (RSC fetches) pass without re-checking.
// Only GET/HEAD page requests are gated; /api, /auth, files and Next assets never come here.

export const DECOY_TEXT = "โปรดขอโค้ดถ้าคุณต้องการตัวโค้ดเว็บไซต์ ติดต่อกับผู้สนับสนุนได้เลย";
export const GATE_COOKIE = "utd_b";
const TTL_SEC = 24 * 3600;

/** Search engines + social / chat link previews (normal page for SEO and previews) and platform health checks. */
const ALLOWED_BOTS =
  /googlebot|google-inspectiontool|googleother|storebot-google|adsbot-google|apis-google|feedfetcher-google|bingbot|bingpreview|msnbot|adidxbot|duckduckbot|yandex(bot|images)|applebot|slurp|facebookexternalhit|facebot|meta-externalfetcher|twitterbot|discordbot|linkedinbot|slackbot|telegrambot|whatsapp|line-poker|linespider|\bline\/|pinterestbot|skypeuripreview|embedly|cloudflare-(healthchecks|traffic-manager|diagnostics)|vercel-(screenshot|favicon)|vercelbot/i;

/** Headless / automation markers that a real browser never sends in its User-Agent. */
const AUTOMATION = /headless|phantomjs|puppeteer|playwright|selenium|electron|lighthouse|chrome-lighthouse|pagespeed/i;

function secret() {
  const s = process.env.APP_SECRET;
  if (s && s.length >= 16) return s;
  return process.env.NODE_ENV === "production" ? null : "dev-only-secret-change-me";
}
const mac = (key: string, data: string) => createHmac("sha256", key).update(`gate|${data}`).digest("base64url").slice(0, 22);

export function issueGateCookie(nowSec = Math.floor(Date.now() / 1000)) {
  const key = secret();
  if (!key) return null;
  const exp = nowSec + TTL_SEC;
  return { name: GATE_COOKIE, value: `${exp}.${mac(key, String(exp))}`, maxAge: TTL_SEC };
}

export function validGateCookie(value: string | undefined, nowSec = Math.floor(Date.now() / 1000)) {
  const key = secret();
  if (!key || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < nowSec) return false;
  const want = Buffer.from(mac(key, exp));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

type HeaderBag = { get(name: string): string | null };

/**
 * "pass" = serve the page; "pass+cookie" = serve it and set the gate cookie (a fresh browser navigation);
 * "decoy" = answer with the decoy page.
 */
export function gate(h: HeaderBag, cookie: string | undefined): "pass" | "pass+cookie" | "decoy" {
  const ua = h.get("user-agent") ?? "";
  if (ALLOWED_BOTS.test(ua)) return "pass";
  if (!/^Mozilla\/5\.0 /.test(ua) || AUTOMATION.test(ua)) return "decoy";
  if (validGateCookie(cookie)) return "pass";

  const mode = h.get("sec-fetch-mode");
  const dest = h.get("sec-fetch-dest");
  const site = h.get("sec-fetch-site");
  const accept = h.get("accept") ?? "";
  const lang = h.get("accept-language");
  if (mode || dest || site) {
    // a top-level navigation by the browser itself
    if (mode === "navigate" && (dest === "document" || dest === "iframe") && accept.includes("text/html") && lang) return "pass+cookie";
    // the app's own in-page requests (RSC fetches) from one of its pages, e.g. when cookies are blocked.
    // (Next.js removes its internal "rsc" header before the proxy runs, so it cannot be required here.)
    if (site === "same-origin" && (mode === "cors" || mode === "same-origin")) return "pass";
    return "decoy";
  }
  // older browsers without Sec-Fetch-* (e.g. Safari before 16.4): a full browser-style request
  if (accept.includes("text/html") && lang && h.get("accept-encoding")) return "pass+cookie";
  return "decoy";
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** The decoy page: one centred message in the site's colours, with the council's public channel. */
export function decoyHtml() {
  const fb = CHANNELS.find((c) => c.key === "facebook") ?? CHANNELS[0];
  return `<!-- ${DECOY_TEXT} -->
<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>สภานักเรียนโรงเรียนอุตรดิตถ์</title>
<style>html,body{margin:0;height:100%}body{display:grid;place-items:center;padding:16px;box-sizing:border-box;background:#f7f8fc;color:#111a33;font:16px/1.7 system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}main{max-width:32rem;text-align:center;background:#fff;border:1px solid #e6eaf2;border-radius:20px;padding:32px 24px;box-shadow:0 8px 28px -6px rgb(11 31 77/.1)}p{margin:0 0 20px;font-size:1.15rem;font-weight:600;color:#0b1f4d}a{display:inline-block;padding:10px 20px;border-radius:999px;background:#0b1f4d;color:#f5f7ff;text-decoration:none}a:hover{background:#c2185b}</style>
</head><body><main><p>${esc(DECOY_TEXT)}</p><a href="${esc(fb.href)}" rel="noopener noreferrer">${esc(fb.label)}</a></main></body></html>
`;
}
