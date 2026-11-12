import { describe, expect, it } from "vitest";
import { gate, pathKind } from "../lib/browser-gate";

// Middleware decision matrix for the anti-code-fetching gate (lib/browser-gate.ts gate()). These are the decisions the
// proxy makes on every request; they must stay stable so real browsers never get a 403 and scrapers never get the page.

const H = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IOS_INAPP = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram";
// a real top-level navigation
const nav = (extra: Record<string, string> = {}) =>
  H({ "user-agent": CHROME, "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "none", accept: "text/html,application/xhtml+xml", "accept-language": "th,en", host: "utdsc.com", ...extra });
const d = (h: ReturnType<typeof H>, path: string, method = "GET", cookie?: string, botOk = false) => gate(h, method, path, cookie, botOk);

describe("real browsers reach pages", () => {
  it("top-level navigation → pass (page)", () => expect(d(nav(), "/th")).toBe("pass"));
  it("top-level navigation → pass (login)", () => { expect(d(nav(), "/th/login")).toBe("pass"); expect(d(nav(), "/en/login")).toBe("pass"); });
  it("in-app browser (no Sec-Fetch-*, mobile UA, text/html) → pass", () =>
    expect(d(H({ "user-agent": IOS_INAPP, accept: "text/html", "accept-language": "th", host: "utdsc.com" }), "/th")).toBe("pass"));
  it("same-origin RSC prefetch → pass", () =>
    expect(d(H({ "user-agent": CHROME, "sec-fetch-mode": "cors", "sec-fetch-site": "same-origin", host: "utdsc.com" }), "/th")).toBe("pass"));
});

describe("scrapers and tools get the decoy", () => {
  it("curl on a page → decoy", () => expect(d(H({ "user-agent": "curl/8.4.0", accept: "*/*", host: "utdsc.com" }), "/th")).toBe("decoy"));
  it("extension-origin request → decoy", () =>
    expect(d(H({ "user-agent": CHROME, origin: "chrome-extension://abcd", "sec-fetch-mode": "cors", "sec-fetch-site": "none", host: "utdsc.com" }), "/th")).toBe("decoy"));
  it("HTML fetched by cors (view-source proxy) → decoy", () =>
    expect(d(H({ "user-agent": CHROME, "sec-fetch-mode": "cors", "sec-fetch-dest": "empty", "sec-fetch-site": "cross-site", accept: "text/html", host: "utdsc.com" }), "/th")).toBe("decoy"));
  it("bare asset fetch without the cookie → decoy", () =>
    expect(d(H({ "user-agent": "curl/8.4.0", host: "utdsc.com" }), "/_next/static/chunks/x.js")).toBe("decoy"));
});

describe("source maps are never served", () => {
  it("*.map → decoy even for a browser", () => expect(d(nav(), "/_next/static/chunks/main.js.map")).toBe("decoy"));
});

describe("assets: first-view subresources pass, verified bots pass", () => {
  it("same-origin script subresource (no cookie yet) → pass", () =>
    expect(d(H({ "user-agent": CHROME, "sec-fetch-mode": "no-cors", "sec-fetch-dest": "script", "sec-fetch-site": "same-origin", host: "utdsc.com" }), "/_next/static/chunks/x.js")).toBe("pass"));
  it("DNS-verified bot (botOk) → pass on a page", () =>
    expect(gate(H({ "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", host: "utdsc.com" }), "GET", "/th", undefined, true)).toBe("pass"));
});

describe("always-open paths bypass the gate", () => {
  it("/auth/callback → pass even for curl", () =>
    expect(d(H({ "user-agent": "curl/8.4.0", host: "utdsc.com" }), "/auth/callback")).toBe("pass"));
  it("/.well-known/* → open + pass for a non-browser fetcher", () => {
    expect(pathKind("/.well-known/acme-challenge/tokenXYZ")).toBe("open");
    expect(d(H({ "user-agent": "cert-bot", host: "utdsc.com" }), "/.well-known/acme-challenge/tokenXYZ")).toBe("pass");
  });
  it("/api/gate → open", () => expect(pathKind("/api/gate")).toBe("open"));
});

describe("writes (Server Actions) honour origin", () => {
  it("same-origin POST to a page → pass", () =>
    expect(d(H({ "user-agent": CHROME, "sec-fetch-site": "same-origin", host: "utdsc.com" }), "/th", "POST")).toBe("pass"));
  it("cross-site POST without a cookie → decoy", () =>
    expect(d(H({ "user-agent": CHROME, "sec-fetch-site": "cross-site", host: "utdsc.com" }), "/th", "POST")).toBe("decoy"));
});
