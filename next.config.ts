import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Static security headers. CSP (with per-request nonce) is set in proxy.ts.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Robots-Tag", value: "noai, noimageai" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // ISR pages: Cache-Control s-maxage = revalidate (600 s), stale-while-revalidate up to 1 day
  expireTime: 86400,
  poweredByHeader: false,
  // build/deploy date for the footer's "last updated" line (inlined at build time)
  env: { BUILD_DATE: new Date().toISOString() },
  productionBrowserSourceMaps: false,
  // share images rendered on request (policy pages) read the Thai font and the emblem from disk
  outputFileTracingIncludes: { "/**/opengraph-image*": ["./assets/fonts/*.ttf", "./public/brand/logo-council-256.png"] },
  reactStrictMode: true,
  async redirects() {
    // v2 single page: old section routes -> matching tab (with or without a locale prefix; proxy.ts adds the prefix)
    const old: [string, string][] = [
      ["/news/:path*", ""], ["/events/:path*", ""], ["/contact", ""], ["/documents", ""],
      ["/members", "?tab=council"], ["/team", "?tab=council"], ["/council", "?tab=council"], ["/about", "?tab=council"],
      ["/policies", "?tab=policy"], ["/advisors", "?tab=advisor"],
    ];
    return old.flatMap(([from, q]) => [
      { source: from, destination: `/${q}`, permanent: true },
      { source: `/:locale(th|en)${from}`, destination: `/:locale${q}`, permanent: true },
    ]);
  },
  async headers() {
    // public pages: Vercel's CDN may keep them 10 min (it sits behind proxy.ts, so the gate still runs). Cloudflare
    // sits in FRONT of the proxy: it must never cache pages or files, or it would serve them past the gate.
    const cdn = [
      { key: "CDN-Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=86400" },
      { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
    ];
    const files = [
      // 30 days: a changed file gets a new name (banner-02-1 -> banner-03-1), never new content under an old name
      { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=31536000" },
      { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      ...["/:locale(th|en)", "/:locale(th|en)/voice", "/:locale(th|en)/policies/:slug", "/:locale(th|en)/home/:year/:tab"].map((source) => ({ source, headers: cdn })),
      ...["/banners/:file*", "/banner/:file*", "/brand/:file*", "/credits/:file*", "/illustrations/:file*", "/flags/:file*"].map((source) => ({ source, headers: files })),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
