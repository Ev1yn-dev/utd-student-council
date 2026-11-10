// Council roles (lib/council.ts): Thai title -> role. The council has no vice head: "รองหัวหน้า…" is a plain member.
// Run: npm run test:council   (Node >= 23 runs TypeScript directly)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { COUNCIL_ROLES, roleFromTitle, type CouncilRole, type Department } from "../lib/council.ts";

// 1. title -> role ("รองประธาน" first: it contains "ประธาน")
const titles: [string, CouncilRole][] = [
  ["ประธานนักเรียนคณะกรรมการสภานักเรียน", "president"],
  ["ประธานคณะกรรมการสภานักเรียน", "president"],
  ["รองประธานคณะกรรมการสภานักเรียนฝ่ายบริหารทั่วไป", "vice_president"],
  ["  รองประธาน ฝ่ายบริหารวิชาการ", "vice_president"],
  ["หัวหน้าฝ่ายเลขานุการ", "head"],
  ["หัวหน้าฝ่ายโสตทัศนศึกษา", "head"],
  ["รองหัวหน้าฝ่ายประชาสัมพันธ์", "member"],
  ["รอง หัวหน้าฝ่ายสวัสดิการ", "member"],
  ["เลขานุการ", "member"],
  ["กรรมการฝ่ายกิจกรรม", "member"],
  ["", "member"],
];
for (const [title, want] of titles) assert.equal(roleFromTitle(title), want, JSON.stringify(title));

// 2. the department file keeps its order and has no vice-head slots
const depts: Department[] = JSON.parse(readFileSync(new URL("../content/council-departments.json", import.meta.url), "utf8")).departments;
assert.equal(depts.length, 12);
assert.deepEqual(depts.slice(0, 2).map((d) => d.key), ["executive", "policy"]);
assert.ok(depts.every((d) => !("pendingDeputies" in d)));
assert.ok(!(COUNCIL_ROLES as readonly string[]).includes("deputy_head"));

console.log("council roles: ok");
