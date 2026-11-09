import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { GATE_COOKIE, botClass, decoyBody, gate, pathKind } from "@/lib/browser-gate";
import { TRAP_PATHS, isAiCrawler, isBlockedTool, verifySearchBot } from "@/lib/bots";
import { clientIp } from "@/lib/client-ip";
import { SUPABASE_URL, isAdminUser, supabaseConfigured } from "@/lib/env";
import { ban, isBanned, limit } from "@/lib/ratelimit";
import { RL_BYPASS_COOKIE, ipAllowlisted, issueBypass, rlBypassCookie, verifyBypass } from "@/lib/rl-bypass";
import { auditBypass, logSecurity } from "@/lib/security-log";
import { SITE_HOST, SITE_URL } from "@/lib/site";
import { refreshSession } from "@/lib/supabase/proxy";

const isDev = process.env.NODE_ENV === "development";
const SB_ORIGIN = SUPABASE_URL ? new URL(SUPABASE_URL).origin : "";

// Sign-in, back office and APIs: rendered per request (session), nonce CSP, rate limits, never cached.
const DYNAMIC = /^(?:\/(?:th|en))?\/(dashboard|admin|pending-access|login)(\/|$)|^\/(auth|api)(\/|$)/;
// ...of which these need a session (role is checked again server-side in every page/action)
const PRIVATE = /^(?:\/(?:th|en))?\/(dashboard|admin|pending-access)(\/|$)/;
const NOINDEX = /^(?:\/(?:th|en))?\/(dashboard|admin|pending-access|login|auth)(\/|$)|^\/api(\/|$)/;
// Sign-in and back office only work on the primary domain (auth cookies, Google redirect URI).
const PRIMARY_ONLY = /^(?:\/(?:th|en))?\/(login|admin|dashboard|pending-access)(\/|$)|^\/auth(\/|$)/;
// Not pages: route handlers and files keep their unprefixed paths.
const NOT_PAGE = /^\/(api|auth|_hp)(\/|$)|\.[a-z0-9]+$/i;
const HOME = /^\/(th|en)\/?$/;
const intl = createIntlMiddleware(routing);

/** Per-request nonce CSP for dynamic pages (sign-in, back office). */
function csp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'", // inline style="" from animation libs; scripts stay nonce-locked
    ...COMMON,
  ].join("; ");
}
/**
 * Fixed CSP for public pages, which are static / ISR and cached by the CDN: a per-request nonce would force every
 * public page to render per request. Inline scripts are Next.js's own bootstrap; no user HTML is ever rendered.
 */
const PUBLIC_CSP = [
  "default-src 'self'",
  // static.cloudflareinsights.com: Cloudflare Web Analytics beacon, injected into public pages by Cloudflare
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
].join("; ");
const COMMON = [
  `img-src 'self' blob: data: ${SB_ORIGIN}`,
  "font-src 'self'",
  `connect-src 'self' ${SB_ORIGIN} https://challenges.cloudflare.com https://cloudflareinsights.com${isDev ? " ws: wss:" : ""}`,
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
];
const publicCsp = () => `${PUBLIC_CSP}; ${COMMON.join("; ")}`;

/** The anti-code-fetching answer (lib/browser-gate.ts): 403 with the message, never cached anywhere. */
function decoy(req: NextRequest) {
  const { body, type } = decoyBody(req.headers.get("accept"));
  return new NextResponse(body, {
    status: 403,
    headers: {
      "content-type": type,
      "cache-control": "no-store",
      "cdn-cache-control": "no-store",
      "cloudflare-cdn-cache-control": "no-store",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "x-robots-tag": "noindex, nofollow",
      vary: "*",
    },
  });
}

function deny(status: number, body: string, extra?: Record<string, string>) {
  return new NextResponse(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", ...extra } });
}

/**
 * Hosts: utdsc.com is the site (SITE_URL). www -> 301 to it. *.vercel.app (production alias and previews): public pages
 * open but are noindex; sign-in / back office -> 308 to the same path on utdsc.com. Any other host -> 301 to utdsc.com.
 * localhost is always served as is (development, tests).
 */
function hostRule(req: NextRequest): NextResponse | "secondary" | null {
  const hostname = (req.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const primary = SITE_HOST.replace(/:\d+$/, "");
  if (hostname === primary || hostname === "localhost" || hostname === "127.0.0.1" || primary === "localhost") return null;
  const { pathname, search } = req.nextUrl;
  const target = `${SITE_URL}${pathname}${search}`;
  if (hostname === `www.${primary}`) return NextResponse.redirect(target, 301);
  if (hostname.endsWith(".vercel.app")) return PRIMARY_ONLY.test(pathname) ? NextResponse.redirect(target, 308) : "secondary";
  return NextResponse.redirect(`${SITE_URL}${pathname}`, 301);
}

export async function proxy(req: NextRequest) {
  const host = hostRule(req);
  if (host instanceof NextResponse) return host;
  const { pathname } = req.nextUrl;
  const ip = clientIp(req.headers);
  // scanner paths first (they also look like files): ban + refuse
  if (TRAP_PATHS.test(pathname)) {
    await ban(ip);
    void logSecurity("trap", { ip, path: pathname });
    return decoy(req);
  }

  // anti-code-fetching gate on every request. Search engines must pass a reverse + forward DNS check
  // (cached per IP); link-preview bots and health checks are recognised by User-Agent.
  const ua = req.headers.get("user-agent") ?? "";
  const bot = botClass(ua);
  const botOk = bot === "ua" || (bot === "dns" && (isDev || (await verifySearchBot(ip, ua)) === true));
  if (gate(req.headers, req.method, pathname, req.cookies.get(GATE_COOKIE)?.value, botOk) === "decoy") return decoy(req);

  // files: nothing else to do; Cloudflare must not cache them, or it would hand them to anyone without the gate
  if (pathKind(pathname) === "asset") {
    const res = NextResponse.next();
    res.headers.set("cloudflare-cdn-cache-control", "no-store");
    return res;
  }
  return handle(req, host);
}

async function handle(req: NextRequest, host: "secondary" | null): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get("user-agent") ?? "";
  // real visitor IP (Cloudflare sits in front of Vercel on utdsc.com) — see lib/client-ip.ts
  const ip = clientIp(req.headers);
  const dynamic = DYNAMIC.test(pathname);

  // 1) honeypot / scanner paths: handled in proxy() before the gate

  // 2) user agent policy (no network calls)
  if (!ua.trim()) {
    void logSecurity("ua_blocked", { ip, path: pathname, detail: { ua: "" } });
    return deny(403, "Forbidden");
  }
  if (isAiCrawler(ua) || isBlockedTool(ua)) {
    void logSecurity("ua_blocked", { ip, path: pathname, detail: { ua: ua.slice(0, 80) } });
    return deny(403, "Forbidden");
  }

  // 3) dynamic paths only: bans, search-bot check and rate limits (Redis / DNS). Public pages make no such call —
  //    they are cached; floods there are for Cloudflare.
  if (dynamic) {
    if (await isBanned(ip)) return deny(403, "Forbidden");
    const searchBot = await verifySearchBot(ip, ua);
    if (searchBot === false && !isDev) {
      void logSecurity("fake_bot", { ip, path: pathname });
      return deny(403, "Forbidden");
    }
    //    Google sign-in has its own buckets (start 20 / callback 40 per 10 min per IP).
    if (searchBot !== true) {
      const bucket = pathname.startsWith("/auth/google") ? "authStart" : pathname.startsWith("/auth/") ? "authCallback" : pathname.startsWith("/api/") ? "api" : "page";
      const r = await limit(bucket, ip);
      if (!r.ok) {
        // skipped for an administrator's signed rl_bypass cookie (any path) and for RATE_LIMIT_ALLOW_IPS
        const admin = verifyBypass(req.cookies.get(RL_BYPASS_COOKIE)?.value);
        if (admin) {
          void auditBypass(admin, { ip, path: pathname, rule: bucket });
        } else if (ipAllowlisted(ip)) {
          console.warn(`[security] rl allowlist used rule=${bucket} path=${pathname}`);
        } else {
          void logSecurity("rate_limited", { ip, path: pathname, detail: { rule: bucket } });
          return deny(429, "Too Many Requests", { "retry-after": String(r.retryAfter) });
        }
      }
    }
  }

  // 4) public pages: static CSP, no request headers that would make the page render per request
  if (!dynamic) {
    let res: NextResponse;
    const year = req.nextUrl.searchParams.get("year");
    const tab = req.nextUrl.searchParams.get("tab");
    if (pathname === "/" && routing.locales.includes(req.cookies.get("NEXT_LOCALE")?.value as never)) {
      // language chosen earlier (cookie written by the language switch in the browser)
      res = NextResponse.redirect(new URL(`/${req.cookies.get("NEXT_LOCALE")!.value}${req.nextUrl.search}`, req.url));
    } else if (HOME.test(pathname) && (year || tab)) {
      // ?year= / ?tab= views of the home page are their own cached pages (rendered once, then served from the cache)
      const l = pathname.split("/")[1];
      const y = /^\d{4}$/.test(year ?? "") ? year : "current";
      const t = /^[a-z]{3,10}$/.test(tab ?? "") ? tab : "default";
      res = NextResponse.rewrite(new URL(`/${l}/home/${y}/${t}`, req.url));
    } else {
      res = NOT_PAGE.test(pathname) ? NextResponse.next() : intl(req);
    }
    res.headers.set("content-security-policy", publicCsp());
    if (host === "secondary") res.headers.set("x-robots-tag", "noindex, nofollow");
    return res;
  }

  // 5) dynamic pages: per-request nonce CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", policy);
  // locale routing ("/login" -> "/th/login"); the request headers above (nonce) are passed through
  const res = NOT_PAGE.test(pathname) ? NextResponse.next({ request: { headers } }) : intl(new NextRequest(req, { headers }));
  if (res.headers.has("location")) return res;
  res.headers.set("content-security-policy", policy);
  res.headers.set("cache-control", "private, no-store");
  if (NOINDEX.test(pathname)) res.headers.set("x-robots-tag", "noindex, nofollow, noai, noimageai");

  if (PRIVATE.test(pathname)) {
    const user = supabaseConfigured() ? await refreshSession(req, res) : null;
    if (!user) {
      // a write (Server Action POST) without a session gets a plain 401, not a redirect to the sign-in page
      if (req.method !== "GET" && req.method !== "HEAD") {
        void logSecurity("unauth_write", { ip, path: pathname });
        return deny(401, "Unauthorized");
      }
      const to = req.nextUrl.clone();
      to.pathname = `/${pathname.split("/")[1] === "en" ? "en" : "th"}/login`;
      to.search = "";
      return NextResponse.redirect(to);
    }
    // administrator verified by the Auth server just above, without a site-wide bypass cookie yet (cookies issued
    // before it covered every path): issue one, so /api, the voice form and the rest of the back office skip the limits
    if (isAdminUser(user) && !verifyBypass(req.cookies.get(RL_BYPASS_COOKIE)?.value)) {
      const value = issueBypass(user.email!);
      if (value) res.cookies.set(rlBypassCookie(value));
    }
  }
  return res;
}

export const config = {
  // every request goes through the gate (including /_next/static, /_next/image and prefetches); only the files crawlers
  // need before anything else are left out
  matcher: ["/((?!favicon.ico|robots.txt|sitemap.xml).*)"],
};
