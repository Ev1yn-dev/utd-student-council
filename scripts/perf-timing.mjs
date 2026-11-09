// WebPageTest-style timing in a real Chromium (Playwright): Fast 4G + 4x CPU slowdown, mobile viewport.
//   node scripts/perf-timing.mjs <label> [base=https://utdsc.com] [runs=3]
// Per page: fresh visit (empty cache) and repeat visit (same browser, warm cache), median of `runs`.
// FCP / LCP / CLS from PerformanceObserver; TBT = sum over long tasks (>50 ms) of (duration - 50) until LCP + 5 s;
// JS = gzipped bytes of every script fetched before the load event (Resource Timing encodedBodySize).
// Writes docs/lighthouse/<label>/timing.json and timing.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const [label = "run", base = "https://utdsc.com", runsArg = "3"] = process.argv.slice(2);
const RUNS = Number(runsArg);
const PAGES = ["/th", "/th/voice", "/th?tab=policy", "/th?tab=council", "/th?tab=advisor", "/en"];
const UA = "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
// Chrome DevTools "Fast 4G": 9 Mbps down, 1.5 Mbps up, 60 ms latency
const NET = { offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 };

const OBSERVE = () => {
  const w = window;
  w.__m = { fcp: 0, lcp: 0, cls: 0, long: [] };
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.name === "first-contentful-paint") w.__m.fcp = e.startTime; })).observe({ type: "paint", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { w.__m.lcp = e.startTime; })).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) w.__m.cls += e.value; })).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => w.__m.long.push([e.startTime, e.duration]))).observe({ type: "longtask", buffered: true });
};

async function visit(page, url) {
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForTimeout(3000);
  return page.evaluate(() => {
    const m = window.__m;
    const fcp = m.fcp || performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0;
    const tbt = m.long.filter(([s]) => s >= fcp && s <= m.lcp + 5000).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    const load = performance.getEntriesByType("navigation")[0];
    const js = performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script" && r.startTime <= load.loadEventStart).reduce((a, r) => a + r.encodedBodySize, 0);
    return { fcp, lcp: m.lcp, cls: m.cls, tbt, js, ttfb: load.responseStart, status: load.responseStatus };
  });
}

const med = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const browser = await chromium.launch();
const rows = [];
for (const path of PAGES) {
  const fresh = [];
  const repeat = [];
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, locale: "th-TH" });
    await ctx.addInitScript(OBSERVE);
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", NET);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    fresh.push(await visit(page, base + path));
    repeat.push(await visit(page, base + path));
    await ctx.close();
  }
  const pick = (runs) => Object.fromEntries(["fcp", "lcp", "cls", "tbt", "js", "ttfb"].map((k) => [k, med(runs.map((r) => r[k]))]));
  const row = { path, status: fresh[0].status, fresh: pick(fresh), repeat: pick(repeat), lcpRuns: fresh.map((r) => Math.round(r.lcp)) };
  rows.push(row);
  console.log(path, row.status, "fresh FCP", Math.round(row.fresh.fcp), "LCP", Math.round(row.fresh.lcp), "TBT", Math.round(row.fresh.tbt), "CLS", row.fresh.cls.toFixed(3), "JS", (row.fresh.js / 1024).toFixed(0) + "KB", "| repeat LCP", Math.round(row.repeat.lcp));
}
await browser.close();
const out = join("docs", "lighthouse", label);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "timing.json"), JSON.stringify({ base, runs: RUNS, at: new Date().toISOString(), rows }, null, 1));
const ms = (v) => `${Math.round(v)}`;
writeFileSync(join(out, "timing.md"), [
  `# Timing — ${label}`, "", `${new Date().toISOString()} · ${base} · Playwright Chromium, Fast 4G (9 Mbps / 60 ms), CPU 4x, 412x823 @1.75 · median of ${RUNS}`, "",
  "| page | FCP ms | LCP ms | TBT ms | CLS | JS gz KB | repeat LCP ms |", "|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.path} | ${ms(r.fresh.fcp)} | ${ms(r.fresh.lcp)} | ${ms(r.fresh.tbt)} | ${r.fresh.cls.toFixed(3)} | ${(r.fresh.js / 1024).toFixed(0)} | ${ms(r.repeat.lcp)} |`), ""].join("\n"));
