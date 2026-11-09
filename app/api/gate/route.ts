import type { NextRequest } from "next/server";
import { DECOY_TEXT, DEV_COOKIE, isBrowserUa, issueGateCookie, protectionMode, validDevCookie } from "@/lib/browser-gate";
import { RL_BYPASS_COOKIE, verifyBypass } from "@/lib/rl-bypass";
import { isSameOrigin } from "@/lib/security";

/**
 * Issues the short signed cookie (12 h, HttpOnly) that files and /api require. Called by
 * components/layout/BrowserCheck.tsx from one of the site's own pages; anything else gets the 403 message.
 * The JSON answer says which browser-side blocking applies (components/layout/Protect.tsx): PROTECTION_MODE, or
 * "off" for a signed-in administrator (rl_bypass cookie) and for the owner's dev cookie.
 */
export async function POST(req: NextRequest) {
  const h = req.headers;
  const ua = h.get("user-agent") ?? "";
  const site = h.get("sec-fetch-site");
  // in-app browsers (LINE / Instagram / Facebook web views) may send no Sec-Fetch-* at all: Origin must still be ours
  const fetchMeta = site === null && h.get("sec-fetch-mode") === null ? /iPhone|iPad|iPod|Android/.test(ua) : site === "same-origin" && ["cors", "same-origin"].includes(h.get("sec-fetch-mode") ?? "");
  const ok = fetchMeta && isSameOrigin(req) && isBrowserUa(ua);
  const c = ok ? issueGateCookie() : null;
  if (!c) return new Response(`${DECOY_TEXT}\n`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const exempt = !!verifyBypass(req.cookies.get(RL_BYPASS_COOKIE)?.value) || validDevCookie(req.cookies.get(DEV_COOKIE)?.value);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return Response.json(
    { mode: exempt ? "off" : protectionMode() },
    { headers: { "cache-control": "no-store", "set-cookie": `${c.name}=${c.value}; Path=/; Max-Age=${c.maxAge}; HttpOnly; SameSite=Lax${secure}` } },
  );
}
