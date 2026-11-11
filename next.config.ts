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
  // CSS as a normal <link> (16.9 KB gz, cached across pages). Inlining it (inlineCss) also copied all 104 KB of it into
  // the RSC payload of every page (333 KB HTML on /th); measured slower on mobile (Lighthouse 84 -> 86/87 locally).
  experimental: { inlineCss: false },
  async redirects() {
    // v2 single page: old section routes -> matching tab (with or without a locale prefix; proxy.ts adds the prefix)
    const old: [string, string][] = [
      ["/news/:path*", ""], ["/events/:path*", ""], ["/contact", ""], ["/documents", ""],
      ["/members", "?tab=council"], ["/team", "?tab=council"], ["/council", "?tab=council"], ["/about", "?tab=council"],
      ["/policies", "?tab=policy"], ["/advisors", "?tab=advisor"],
    ];
    // the second back office (/dashboard) was merged into /admin: its URLs answer 308 to the new ones (query kept)
    const ENTITY = ":entity(announcements|activities|policies|members|advisors)";
    const dashboard: [string, string][] = [
      ["/dashboard", "/admin"], ["/dashboard/hero", "/admin/banners"], ["/dashboard/consent", "/admin/consent"], ["/dashboard/years", "/admin/years"],
      [`/dashboard/${ENTITY}`, "/admin/content/:entity"], [`/dashboard/${ENTITY}/:id`, "/admin/content/:entity/:id"],
    ];
    return [
      ...old.flatMap(([from, q]) => [
        { source: from, destination: `/${q}`, permanent: true },
        { source: `/:locale(th|en)${from}`, destination: `/:locale${q}`, permanent: true },
      ]),
      ...dashboard.flatMap(([from, to]) => [
        { source: from, destination: to, permanent: true },
        { source: `/:locale(th|en)${from}`, destination: `/:locale${to}`, permanent: true },
      ]),
    ];
  },
  async headers() {
    // public pages: Vercel's CDN may keep them 10 min (it sits behind proxy.ts, so the gate still runs). Cloudflare
    // sits in FRONT of the proxy: it must never cache pages or files, or it would serve them past the gate.
    const cdn = [
      { key: "CDN-Cache-Control", value: "public, s-maxage=600, stale-while-revalidate=86400" },
      { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
    ];
    // 1 year, immutable: a changed file must get a new name (banner-02-1 -> banner-03-1, logo-council-176 ...),
    // never new content under an old name. /_next/static is already immutable (hashed names).
    const files = [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      { key: "Cloudflare-CDN-Cache-Control", value: "no-store" },
    ];
    // app/icon.png, app/apple-icon.png are linked with a content hash (?abc123)
    const icons = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];
    return [
      { source: "/:path*", headers: securityHeaders },
      ...["/:locale(th|en)", "/:locale(th|en)/voice", "/:locale(th|en)/policies/:slug", "/:locale(th|en)/home/:year/:tab"].map((source) => ({ source, headers: cdn })),
      ...["/banners/:file*", "/banner/:file*", "/brand/:file*", "/credits/:file*", "/illustrations/:file*", "/flags/:file*", "/images/council/:file*"].map((source) => ({ source, headers: files })),
      ...["/icon.png", "/apple-icon.png"].map((source) => ({ source, headers: icons })),
      // no content hash in its name: 1 day, so a new crest reaches browsers and Google's favicon fetcher
      { source: "/favicon.ico", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "public, max-age=86400" }] },
    ];
  },
  turbopack: {
    // Next's built-in polyfills for features every supported browser already has (Lighthouse "legacy JavaScript"):
    // replaced by lib/polyfill-module.js, which keeps only URL.canParse
    resolveAlias: {
      "next/dist/build/polyfills/polyfill-module": "./lib/polyfill-module.js",
      "../build/polyfills/polyfill-module": { browser: "./lib/polyfill-module.js" },
    },
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
