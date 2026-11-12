import { describe, expect, it } from "vitest";
import { gate, protectionMode } from "../lib/browser-gate";

// Regression for the 2026-11-12 login-403 incident + kill switch: PROTECTION_MODE=off must disable the gate, and a
// real top-level navigation to /login must pass even without the kill switch. (The ban / rate-limit / UA paths that
// also honour `bypass` live in proxy.ts handle(); this covers the gate contract the kill switch rides on.)

const headers = (h: Record<string, string>) => ({ get: (k: string) => h[k.toLowerCase()] ?? null });
const navTo = (path: string, extra: Record<string, string> = {}) =>
  gate(
    headers({
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
      "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", "sec-fetch-site": "none",
      accept: "text/html,application/xhtml+xml", "accept-language": "th,en", host: "utdsc.com", ...extra,
    }),
    "GET", path, undefined, false, false,
  );

describe("PROTECTION_MODE parsing", () => {
  it("recognises the off kill switch", () => {
    expect(protectionMode("off")).toBe("off");
    expect(protectionMode(" OFF ")).toBe("off");
    expect(protectionMode(undefined)).toBe("strict");
    expect(protectionMode("anything")).toBe("strict");
  });
});

describe("gate() lets real browsers reach login", () => {
  it("a top-level navigation to /th/login passes without any bypass", () => {
    expect(navTo("/th/login")).toBe("pass");
    expect(navTo("/en/login")).toBe("pass");
  });
  it("the kill switch (bypass=true) passes any page, even a scraper-looking request", () => {
    const scraper = headers({ "user-agent": "curl/8.4.0", host: "utdsc.com" });
    expect(gate(scraper, "GET", "/th/login", undefined, false, true)).toBe("pass");
  });
  it("source maps stay blocked even with the kill switch (never served)", () => {
    const h = headers({ "user-agent": "Mozilla/5.0", host: "utdsc.com" });
    expect(gate(h, "GET", "/_next/static/chunks/main.js.map", undefined, false, true)).toBe("decoy");
  });
});
