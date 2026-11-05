// Student roster CSV parser (no imports: also used by scripts/roster-import.mts under plain Node).
//
// Accepted layouts:
//   with a header row, columns by name: student_id, grade, room, prefix, first_name, last_name[, active]
//   (Thai headers รหัส/รหัสนักเรียน, ชั้น/ระดับชั้น, ห้อง, คำนำหน้า, ชื่อ, นามสกุล, สถานะ also work)
//   without a header: student_id, grade[, active]
// grade may be 4, ม.4, ม4, M.4 or with a room (ม.4/2 also fills the room). Separators: comma, semicolon or tab.
// Nothing here logs: rows hold names and IDs of minors.

export const STUDENT_ID = /^[0-9]{5}$/;

export type RosterRow = {
  student_id: string;
  grade: number;
  active: boolean;
  room: string | null;
  prefix: string | null;
  first_name: string | null;
  last_name: string | null;
};

const HEADERS: Record<string, keyof RosterRow> = {
  student_id: "student_id", id: "student_id", "รหัส": "student_id", "รหัสนักเรียน": "student_id", "เลขประจำตัว": "student_id", "เลขประจำตัวนักเรียน": "student_id",
  grade: "grade", "ชั้น": "grade", "ระดับชั้น": "grade",
  room: "room", "ห้อง": "room",
  prefix: "prefix", "คำนำหน้า": "prefix", "คำนำหน้าชื่อ": "prefix",
  first_name: "first_name", "ชื่อ": "first_name",
  last_name: "last_name", "นามสกุล": "last_name",
  active: "active", "สถานะ": "active",
};
const INACTIVE = ["0", "false", "no", "n", "ไม่", "inactive", "ลาออก", "จบ", "ย้าย"];

/** One CSV line into cells (handles "quoted, cells" and "" escapes). */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

const text = (v: string | undefined, max: number) => {
  const s = (v ?? "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

export function parseRosterCsv(input: string): { rows: RosterRow[]; bad: number[]; dupes: number[] } {
  const rows: RosterRow[] = [];
  const bad: number[] = [];
  const dupes: number[] = [];
  const seen = new Set<string>();
  const lines = input.replace(/^﻿/, "").split(/\r?\n/);

  // header row -> column index per field; otherwise the short positional layout
  const first = cells(lines[0] ?? "").map((h) => h.toLowerCase().replace(/^﻿/, ""));
  const hasHeader = !!first[0] && !/^[0-9]/.test(first[0]);
  const col: Partial<Record<keyof RosterRow, number>> = hasHeader
    ? Object.fromEntries(first.flatMap((h, i) => (HEADERS[h] ? [[HEADERS[h], i]] : [])))
    : { student_id: 0, grade: 1, active: 2 };
  if (hasHeader && (col.student_id === undefined || col.grade === undefined)) return { rows, bad: [1], dupes };

  lines.forEach((line, i) => {
    if ((hasHeader && i === 0) || !line.trim()) return;
    const c = cells(line);
    const get = (k: keyof RosterRow) => (col[k] === undefined ? undefined : c[col[k]!]);
    const id = (get("student_id") ?? "").trim();
    const g = (get("grade") ?? "").replace(/^(ม\.?|m\.?)\s*/i, "");
    const grade = Number(g.match(/^[1-6]/)?.[0]);
    if (!STUDENT_ID.test(id) || !grade) return void bad.push(i + 1);
    if (seen.has(id)) return void dupes.push(i + 1);
    seen.add(id);
    const roomFromGrade = g.match(/^[1-6]\s*\/\s*(\w{1,4})/)?.[1];
    rows.push({
      student_id: id,
      grade,
      active: !INACTIVE.includes((get("active") ?? "").trim().toLowerCase()),
      room: text(get("room"), 10) ?? roomFromGrade ?? null,
      prefix: text(get("prefix"), 30),
      first_name: text(get("first_name"), 100),
      last_name: text(get("last_name"), 100),
    });
  });
  return { rows, bad, dupes };
}
