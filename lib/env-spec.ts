// What each environment variable is for, how to tell a real value from a test/placeholder one, and where to get it.
// Used by /admin/setup (status only — values are never sent to the browser) and by the dev-server warning
// (instrumentation.ts). Human-readable help lives in messages/<locale>.json under setup.vars.<NAME>.

export type EnvStatus = "set" | "test" | "missing";
export type EnvVar = {
  name: string;
  /** production behaviour when missing: "required" = feature broken / fails closed, "optional" = degraded but works */
  need: "required" | "optional";
  /** safe to expose to the browser (NEXT_PUBLIC_) */
  public: boolean;
  /** where to get it */
  url: string;
  /** used by the app when the variable is absent (then it counts as set) */
  fallback?: string;
  /** value is a known test key / placeholder / too weak */
  isTest?: (v: string) => boolean;
};

const TURNSTILE_TEST_SITE = /^[123]x0{20}AA$/; // Cloudflare's documented always-pass/fail/challenge site keys
const TURNSTILE_TEST_SECRET = /^[123]x0{31}AA$/;

export const ENV_VARS: EnvVar[] = [
  { name: "APP_SECRET", need: "required", public: false, url: "https://nodejs.org/api/crypto.html#cryptorandombytessize-callback", isTest: (v) => v.length < 32 },
  { name: "NEXT_PUBLIC_SITE_URL", need: "required", public: true, url: "https://vercel.com/docs/projects/domains", isTest: (v) => v.replace(/\/+$/, "") !== "https://utdsc.com" || /localhost|127\.0\.0\.1|example\.com/.test(v) },
  { name: "NEXT_PUBLIC_SUPABASE_URL", need: "required", public: true, url: "https://supabase.com/dashboard/project/_/settings/api", isTest: (v) => !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(v) },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", need: "required", public: true, url: "https://supabase.com/dashboard/project/_/settings/api-keys" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", need: "required", public: false, url: "https://supabase.com/dashboard/project/_/settings/api-keys" },
  { name: "UPSTASH_REDIS_REST_URL", need: "optional", public: false, url: "https://console.upstash.com/redis", isTest: (v) => !/^https:\/\//.test(v) },
  { name: "UPSTASH_REDIS_REST_TOKEN", need: "optional", public: false, url: "https://console.upstash.com/redis" },
  { name: "GOOGLE_SITE_VERIFICATION", need: "optional", public: true, url: "https://search.google.com/search-console" },
  { name: "BING_SITE_VERIFICATION", need: "optional", public: true, url: "https://www.bing.com/webmasters" },
  { name: "RATE_LIMIT_ALLOW_IPS", need: "optional", public: false, url: "https://utdsc.com/api/admin/whoami" },
  { name: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", need: "required", public: true, url: "https://dash.cloudflare.com/?to=/:account/turnstile", isTest: (v) => TURNSTILE_TEST_SITE.test(v) },
  { name: "TURNSTILE_SECRET_KEY", need: "required", public: false, url: "https://dash.cloudflare.com/?to=/:account/turnstile", isTest: (v) => TURNSTILE_TEST_SECRET.test(v) },
  { name: "ALLOWED_EMAIL_DOMAIN", need: "optional", public: false, url: "https://admin.google.com/", fallback: "utd.ac.th" },
  { name: "COUNCIL_EMAILS", need: "optional", public: false, url: "https://admin.google.com/" },
  { name: "ADMIN_EMAILS", need: "required", public: false, url: "https://supabase.com/dashboard/project/_/auth/users", isTest: (v) => /example\.com/.test(v) },
];

export function envStatus(v: EnvVar, env: Record<string, string | undefined> = process.env): EnvStatus {
  const value = env[v.name]?.trim() || v.fallback;
  if (!value) return "missing";
  return v.isTest?.(value) ? "test" : "set";
}
