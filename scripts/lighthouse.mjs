// Lighthouse, mobile + desktop, N runs per page, median by Performance score.
//   node scripts/lighthouse.mjs <label> [runs=3] [base=https://utdsc.com]
// Writes docs/lighthouse/<label>/<page>-<form>.json (median run, screenshots stripped) and summary.md.
//
// The anti-code-fetching gate (lib/browser-gate.ts) must serve Lighthouse the real page:
//   - the User-Agent is the normal Chrome UA of the emulated device (Lighthouse's own "Chrome-Lighthouse" suffix is
//     dropped, so the run looks like the browser it emulates), and
//   - when LIGHTHOUSE_TOKEN is set (env or .env.local), a short-lived signed token (15 min) goes in
//     x-lighthouse-token; the gate lets that request through without any other check.
// Lighthouse sends extra headers to every origin the page loads, so the token is short-lived on purpose.
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [label = "run", runsArg = "3", base = "https://utdsc.com", only] = process.argv.slice(2);
const RUNS = Number(runsArg);
const PAGES = [
  ["th", "/th"],
  ["en", "/en"],
  ["th-voice", "/th/voice"],
  ["en-voice", "/en/voice"],
  ["th-policy", "/th?tab=policy"],
  ["th-council", "/th?tab=council"],
].filter(([name]) => !only || only.split(",").includes(name));
const UA = {
  mobile: "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  desktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};
const CATS = ["performance", "accessibility", "best-practices", "seo"];

function envToken() {
  if (process.env.LIGHTHOUSE_TOKEN !== undefined) return process.env.LIGHTHOUSE_TOKEN || null;
  if (!existsSync(".env.local")) return null;
  const m = readFileSync(".env.local", "utf8").match(/^LIGHTHOUSE_TOKEN=(.+)$/m);
  return m ? m[1].trim() : null;
}
const key = envToken();
const token = () => {
  // 14 min: under the gate's 15-min cap even if the host clock runs a little behind this machine
  const exp = Math.floor(Date.now() / 1000) + 840;
  return `${exp}.${createHmac("sha256", key).update(`lighthouse|${exp}`).digest("base64url")}`;
};

const out = join("docs", "lighthouse", label);
mkdirSync(out, { recursive: true });
const tmp = join(out, ".tmp.json");
const hdr = join(out, ".headers.json");
// npx runs through a shell on Windows: every argument is quoted (the User-Agent has spaces and ";")
const q = (a) => `"${a.replace(/"/g, '\\"')}"`;
const score = (r) => CATS.map((c) => Math.round((r.categories[c].score ?? 0) * 100));

const rows = [];
for (const [name, path] of PAGES) {
  for (const form of ["mobile", "desktop"]) {
    const runs = [];
    let failures = 0;
    while (runs.length < RUNS) {
      const args = ["-y", "lighthouse@12", base + path, "--quiet", "--chrome-flags=--headless", "--output=json", `--output-path=${tmp}`,
        `--only-categories=${CATS.join(",")}`, `--emulated-user-agent=${UA[form]}`];
      if (form === "desktop") args.push("--preset=desktop");
      if (key) {
        writeFileSync(hdr, JSON.stringify({ "x-lighthouse-token": token() }));
        args.push(`--extra-headers=${hdr}`);
      }
      if (existsSync(tmp)) rmSync(tmp);
      try { execFileSync("npx", args.map(q), { stdio: "ignore", shell: true }); } catch { /* the report says what failed */ }
      const r = existsSync(tmp) ? JSON.parse(readFileSync(tmp, "utf8")) : { runtimeError: { code: "NO_REPORT" } };
      if (r.runtimeError) {
        console.log(`${name} ${form}: ${r.runtimeError.code}`);
        if (++failures > 3) throw new Error(`${name} ${form}: Lighthouse keeps failing (${r.runtimeError.code})`);
        continue;
      }
      runs.push(r);
    }
    runs.sort((a, b) => a.categories.performance.score - b.categories.performance.score);
    const med = runs[Math.floor(runs.length / 2)];
    for (const k of ["final-screenshot", "screenshot-thumbnails", "full-page-screenshot"]) delete med.audits[k];
    delete med.fullPageScreenshot;
    writeFileSync(join(out, `${name}-${form}.json`), JSON.stringify(med));
    // every scored audit below 100 in the median run (Performance: the metrics and anything else with a score)
    const ids = new Set(CATS.flatMap((c) => med.categories[c].auditRefs.map((x) => x.id)));
    const failing = [...ids]
      .map((id) => med.audits[id])
      .filter((a) => a && a.score !== null && a.score < 1 && !["informative", "manual", "notApplicable"].includes(a.scoreDisplayMode))
      .map((a) => `${a.id}${a.displayValue ? ` (${a.displayValue})` : ""}`);
    rows.push({ name, path, form, med: score(med), all: runs.map(score), bench: Math.round(med.environment.benchmarkIndex), failing });
    console.log(name, form, score(med).join("/"), "perf runs:", runs.map((r) => score(r)[0]).join(","), "bench:", Math.round(med.environment.benchmarkIndex));
  }
}
const md = [`# Lighthouse — ${label}`, "", `${new Date().toISOString()} · ${base} · ${RUNS} runs each, median by Performance · Lighthouse 12`, "",
  "| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |", "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.path} | ${r.form} | ${r.med.join(" | ")} | ${r.all.map((s) => s[0]).join(", ")} | ${r.bench} |`), "", "## Failing audits (median run)", "",
  ...rows.flatMap((r) => [`### ${r.path} — ${r.form}`, ...(r.failing.length ? r.failing.map((f) => `- ${f}`) : ["- none"]), ""])];
writeFileSync(join(out, only ? `summary-${only.replace(/,/g, "+")}.md` : "summary.md"), md.join("\n"));
for (const f of [tmp, hdr]) if (existsSync(f)) rmSync(f);
