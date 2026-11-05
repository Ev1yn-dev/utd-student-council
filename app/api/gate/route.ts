import { DECOY_TEXT, isBrowserUa, issueGateCookie } from "@/lib/browser-gate";
import { isSameOrigin } from "@/lib/security";

/**
 * Issues the short signed cookie (12 h, HttpOnly) that files and /api require. Called by
 * components/layout/BrowserCheck.tsx from one of the site's own pages; anything else gets the 403 message.
 */
export async function POST(req: Request) {
  const h = req.headers;
  const ok =
    h.get("sec-fetch-site") === "same-origin" &&
    ["cors", "same-origin"].includes(h.get("sec-fetch-mode") ?? "") &&
    isSameOrigin(req) &&
    isBrowserUa(h.get("user-agent") ?? "");
  const c = ok ? issueGateCookie() : null;
  if (!c) return new Response(`${DECOY_TEXT}\n`, { status: 403, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store", "set-cookie": `${c.name}=${c.value}; Path=/; Max-Age=${c.maxAge}; HttpOnly; SameSite=Lax${secure}` },
  });
}
