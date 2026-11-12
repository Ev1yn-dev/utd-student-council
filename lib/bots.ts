import { promises as dns } from "node:dns";
import { inRanges } from "./client-ip.ts";

/** Scrapers / HTTP libraries / site rippers. Matched against User-Agent (case-insensitive). */
export const BLOCKED_TOOLS =
  /(curl|wget|python-requests|python-urllib|aiohttp|httpx|scrapy|httrack|go-http-client|libwww|java\/|okhttp|node-fetch|undici|axios|got \(|headlesschrome|phantomjs|puppeteer|playwright|selenium|webzip|offline explorer|teleport|sitesucker|libcurl|apache-httpclient|mj12bot|ahrefsbot|semrushbot|dotbot|petalbot|dataforseo)/i;

/** AI / dataset crawlers — also disallowed in robots.txt. */
export const AI_CRAWLERS = [
  "GPTBot", "ChatGPT-User", "OAI-SearchBot", "CCBot", "ClaudeBot", "Claude-Web", "anthropic-ai",
  "Google-Extended", "PerplexityBot", "Bytespider", "Amazonbot", "meta-externalagent",
  "FacebookBot", "Applebot-Extended", "cohere-ai", "Diffbot", "ImagesiftBot", "omgili", "Timpibot",
] as const;
const AI_RE = new RegExp(AI_CRAWLERS.join("|"), "i");

export const isAiCrawler = (ua: string) => AI_RE.test(ua);
export const isBlockedTool = (ua: string) => BLOCKED_TOOLS.test(ua);

/**
 * Search engines, verified by reverse DNS + forward-confirm (the host must end in one of `domains` and resolve back
 * to the same IP), or — DuckDuckBot, which publishes no reverse-DNS names — by DuckDuckGo's published IP list.
 * PageSpeed Insights (Chrome-Lighthouse) is checked like Googlebot: only runs from Google's own hosts pass.
 * Keep the UA patterns in sync with DNS_VERIFIED_BOTS in lib/browser-gate.ts.
 */
const SEARCH_BOTS: Array<{ name: string; ua: RegExp; domains?: string[]; ipList?: string }> = [
  // .gae.googleusercontent.com = Google's user-triggered fetchers (Search Console verification, feeds); never the whole
  // .googleusercontent.com, which is also the reverse DNS of every customer VM on Google Cloud
  { name: "google", ua: /googlebot|google-favicon|google-inspectiontool|googleother|storebot-google|adsbot-google|apis-google|feedfetcher-google|google-site-verification|chrome-lighthouse/i, domains: [".googlebot.com", ".google.com", ".gae.googleusercontent.com"] },
  { name: "bing", ua: /bingbot|bingpreview|msnbot|adidxbot/i, domains: [".search.msn.com"] },
  { name: "apple", ua: /applebot(?!-extended)/i, domains: [".applebot.apple.com"] },
  { name: "duckduckgo", ua: /duckduckbot/i, ipList: "https://duckduckgo.com/duckduckbot.json" },
];

const DAY = 86_400_000;
const cache = new Map<string, { ok: boolean; exp: number }>();
const lists = new Map<string, { ranges: string[]; exp: number }>();

/** The ranges in a published bot IP list, cached 24 h (10 min after a failure). */
async function publishedRanges(url: string): Promise<string[]> {
  const hit = lists.get(url);
  if (hit && hit.exp > Date.now()) return hit.ranges;
  try {
    // {"prefixes":[{"ipv4Prefix":"1.2.3.4/32"},{"ipv6Prefix":"…/64"}]} (same shape as Google's and Bing's lists)
    const j = (await (await fetch(url, { signal: AbortSignal.timeout(3000) })).json()) as { prefixes?: { ipv4Prefix?: string; ipv6Prefix?: string }[] };
    const ranges = (j.prefixes ?? []).map((p) => p.ipv4Prefix ?? p.ipv6Prefix ?? "").filter(Boolean);
    lists.set(url, { ranges, exp: Date.now() + (ranges.length ? DAY : 600_000) });
    return ranges;
  } catch {
    lists.set(url, { ranges: [], exp: Date.now() + 600_000 }); // retry in 10 min
    return [];
  }
}

/**
 * Returns null when the UA is not a search-engine bot, otherwise whether the IP really belongs to it
 * (reverse DNS + forward-confirm, or the published IP list). Cached 24 h per (bot, IP).
 */
export async function verifySearchBot(ip: string, ua: string): Promise<boolean | null> {
  const bot = SEARCH_BOTS.find((b) => b.ua.test(ua));
  if (!bot) return null;
  const key = `${bot.name}|${ip}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.ok;
  let ok = false;
  try {
    if (bot.ipList) {
      ok = inRanges(ip, await publishedRanges(bot.ipList));
    } else {
      const hosts = await dns.reverse(ip);
      for (const h of hosts) {
        if (!bot.domains!.some((d) => h.endsWith(d))) continue;
        const fwd = await dns.lookup(h, { all: true });
        if (fwd.some((a) => a.address === ip)) { ok = true; break; }
      }
    }
  } catch {
    ok = false;
  }
  cache.set(key, { ok, exp: Date.now() + DAY });
  if (cache.size > 10_000) cache.clear();
  return ok;
}

/** Paths only scanners request (and our hidden honeypot). One hit bans the IP from sign-in / back office for an hour;
 * 3 in 10 minutes block it from the whole site for 24 h (lib/trap.ts). Verified search engines are exempt (proxy.ts). */
export const TRAP_PATHS = /^\/(_hp\/|wp-admin|wp-login|wp-content|xmlrpc\.php|\.env|\.git|phpmyadmin|admin\.php|cgi-bin)/i;
