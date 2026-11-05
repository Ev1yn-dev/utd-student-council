import { promises as dns } from "node:dns";

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

const SEARCH_BOTS: Array<{ ua: RegExp; domains: string[] }> = [
  { ua: /googlebot|google-inspectiontool|googleother|storebot-google|adsbot-google|apis-google|feedfetcher-google/i, domains: [".googlebot.com", ".google.com", ".googleusercontent.com"] },
  { ua: /bingbot|bingpreview|msnbot|adidxbot/i, domains: [".search.msn.com"] },
];

const cache = new Map<string, { ok: boolean; exp: number }>();

/**
 * Returns null when the UA is not a search-engine bot, otherwise whether the IP
 * really belongs to it (reverse DNS + forward-confirm). Cached 24h.
 */
export async function verifySearchBot(ip: string, ua: string): Promise<boolean | null> {
  const bot = SEARCH_BOTS.find((b) => b.ua.test(ua));
  if (!bot) return null;
  const hit = cache.get(ip);
  if (hit && hit.exp > Date.now()) return hit.ok;
  let ok = false;
  try {
    const hosts = await dns.reverse(ip);
    for (const h of hosts) {
      if (!bot.domains.some((d) => h.endsWith(d))) continue;
      const fwd = await dns.lookup(h, { all: true });
      if (fwd.some((a) => a.address === ip)) { ok = true; break; }
    }
  } catch {
    ok = false;
  }
  cache.set(ip, { ok, exp: Date.now() + 86_400_000 });
  return ok;
}

/** Paths only scanners request (and our hidden honeypot). Hitting one bans the IP for an hour. */
export const TRAP_PATHS = /^\/(_hp\/|wp-admin|wp-login|wp-content|xmlrpc\.php|\.env|\.git|phpmyadmin|admin\.php|cgi-bin)/i;
