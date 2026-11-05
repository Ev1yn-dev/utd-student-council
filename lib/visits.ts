import "server-only";
import { isAiCrawler, isBlockedTool } from "@/lib/bots";
import { clientCountry } from "@/lib/client-ip";
import { supabaseConfigured } from "@/lib/env";
import { clientIp, visitorIdent } from "@/lib/security";
import { SITE_HOST } from "@/lib/site";
import { adminClient } from "@/lib/supabase/admin";

// Crawlers, link previewers and monitors (the beacon needs JavaScript, so most never send one; this catches the rest).
const BOT = /bot\b|bot\/|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|facebookexternalhit|embedly|monitor|uptime|pingdom|validator/i;

// A page path on this site: locale + up to four segments (policy slugs may be percent-encoded Thai).
const PAGE = /^\/(?:(?:th|en)(?:\/[A-Za-z0-9._~%-]{1,100}){0,4})?$/;

const ownHost = (h: string) => h === SITE_HOST.replace(/:\d+$/, "") || h.endsWith(".vercel.app") || h === "localhost" || h === "127.0.0.1";

/** Page path from the beacon, normalised (no query, no trailing slash), or null when it is not a page of this site. */
export function pagePath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 300) return null;
  const p = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  return PAGE.test(p) && p.length <= 120 ? p : null;
}

/** Referrer domain: "" = direct / unknown, null = internal navigation (not counted as a source). */
export function referrerDomain(raw: unknown): string | null {
  if (raw === undefined) return null;
  if (typeof raw !== "string" || !raw) return "";
  try {
    const h = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
    if (ownHost(h) || ownHost(`www.${h}`)) return null;
    return /^[a-z0-9.-]{1,100}$/.test(h) ? h : "";
  } catch {
    return "";
  }
}

export const deviceOf = (ua: string) => (/Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? "mobile" : "desktop");

/** Counts one page view. Returns false when the request is ignored (bot, bad input, store not configured). */
export async function recordVisit(headers: Headers, body: { p?: unknown; r?: unknown }): Promise<boolean> {
  const ua = headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua) || isAiCrawler(ua) || isBlockedTool(ua)) return false;
  const path = pagePath(body.p);
  if (!path || !supabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const { error } = await adminClient().rpc("track_visit", {
    p_ident: visitorIdent(clientIp(headers), ua),
    p_path: path,
    p_ref: referrerDomain(body.r),
    p_device: deviceOf(ua),
    p_country: clientCountry(headers) ?? "",
  });
  if (error) {
    console.error("[visits] track failed", error.message);
    return false;
  }
  return true;
}
