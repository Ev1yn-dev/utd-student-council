import { describe, expect, it } from "vitest";
import { TRAP_PATHS } from "../lib/bots";

// The trap counter (public.trap_hits) and the ban/auto-block are written ONLY inside `if (TRAP_PATHS.test(pathname))`
// in proxy.ts. So "a page load must never count toward the honeypot" reduces to: TRAP_PATHS must match only real
// scanner paths, never the site's own pages or the sign-in flow.

const COUNTS = ["/.env", "/.env.local", "/.env.production", "/.git/config", "/.git/HEAD", "/wp-login.php", "/wp-admin/", "/wp-content/x.php", "/xmlrpc.php", "/phpmyadmin", "/cgi-bin/x", "/_hp/directory"];
const NEVER = ["/th/login", "/en/login", "/login", "/auth/google", "/auth/callback", "/th", "/en", "/th/admin", "/favicon.ico", "/manifest.webmanifest", "/robots.txt", "/sitemap.xml", "/th/voice", "/th/policies/x", "/api/token", "/_next/static/chunks/main.js"];

describe("honeypot counter only fires on real trap paths", () => {
  it.each(COUNTS)("counts: %s", (p) => expect(TRAP_PATHS.test(p)).toBe(true));
  it.each(NEVER)("never counts: %s", (p) => expect(TRAP_PATHS.test(p)).toBe(false));
});
