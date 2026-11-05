// Imports a student roster CSV into Supabase (same parser and SQL function as /admin/roster).
//   node --no-warnings scripts/roster-import.mts <file.csv> <academic year, e.g. 2569> [--dry]
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local. Prints counts only: never names or IDs.
import { readFileSync } from "node:fs";
import { parseRosterCsv } from "../lib/roster-csv.ts";

const [file, yearArg] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const dry = process.argv.includes("--dry");
const year = Number(yearArg);
if (!file || !(year >= 2500 && year <= 2700)) {
  console.error("usage: node --no-warnings scripts/roster-import.mts <file.csv> <year 25xx> [--dry]");
  process.exit(1);
}
const env: Record<string, string> = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;

const { rows, bad, dupes } = parseRosterCsv(readFileSync(file, "utf8"));
const perGrade = [1, 2, 3, 4, 5, 6].map((g) => `ม.${g}: ${rows.filter((r) => r.grade === g).length}`).join(", ");
console.log(`parsed ${rows.length} rows (${perGrade}); bad lines: ${bad.length}; duplicate lines: ${dupes.length}`);
console.log(`with names: ${rows.filter((r) => r.first_name && r.last_name).length}; with room: ${rows.filter((r) => r.room).length}`);
if (bad.length || dupes.length) {
  console.error(`fix the file first (bad lines ${bad.slice(0, 10).join(",")}; duplicates ${dupes.slice(0, 10).join(",")})`);
  process.exit(1);
}
if (dry) process.exit(0);
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  process.exit(1);
}
const r = await fetch(`${url}/rest/v1/rpc/roster_import`, {
  method: "POST",
  headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({ p_rows: rows, p_year: year }),
});
if (!r.ok) {
  console.error(`import failed: HTTP ${r.status}`);
  process.exit(1);
}
const [res] = (await r.json()) as { upserted: number; deactivated: number }[];
console.log(`imported: ${res.upserted} upserted, ${res.deactivated} set inactive (academic year ${year})`);
