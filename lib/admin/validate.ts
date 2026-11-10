import "server-only";
import { z } from "zod";
import type { Entity, Field } from "@/lib/admin/entities";

// Server-side validation of back-office forms, built with zod from the entity config. Errors are message keys under
// dashboard.errors (+ values), so the client shows them in the reader's language. Never trust the browser's checks.

export type Err = { key: string; values?: Record<string, number> };
export type Parsed = { values: Record<string, unknown>; images: Record<string, string[]>; errors: Record<string, Err> };

const UUID = z.string().uuid();
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)));
/** https only — rejects javascript:, data:, http: and anything that is not a valid absolute URL */
const HTTPS_URL = z.string().url().max(2000).refine((s) => new URL(s).protocol === "https:");
const clean = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\r\n/g, "\n").replace(/\u0000/g, "").trim();

function text(f: Extract<Field, { kind: "text" | "textarea" }>, lang: "th" | "en") {
  let s = z.string().max(f.max, { message: JSON.stringify({ key: "tooLong", values: { max: f.max } }) });
  if (f.required && lang === "th") s = s.min(1, { message: JSON.stringify({ key: "required" }) });
  if (f.kind === "text" && f.pattern && lang === "th") {
    const re = new RegExp(f.pattern.re);
    s = s.refine((v) => !v || re.test(v), { message: JSON.stringify({ key: f.pattern.error }) }) as unknown as typeof s;
  }
  return s;
}
const errOf = (issue: z.core.$ZodIssue | undefined, fallback: Err): Err => {
  try { return issue?.message?.startsWith("{") ? (JSON.parse(issue.message) as Err) : fallback; } catch { return fallback; }
};

export function parse(e: Entity, fd: FormData): Parsed {
  const values: Record<string, unknown> = {};
  const images: Record<string, string[]> = {};
  const errors: Record<string, Err> = {};
  const check = <T,>(name: string, schema: z.ZodType<T>, input: unknown, fallback: Err): T | undefined => {
    const r = schema.safeParse(input);
    if (!r.success) errors[name] = errOf(r.error.issues[0], fallback);
    return r.success ? r.data : undefined;
  };

  for (const f of e.fields) {
    const v = clean(fd.get(f.name));
    switch (f.kind) {
      case "text":
      case "textarea": {
        values[f.name] = check(f.name, text(f, "th"), f.name === "instagram" ? v.replace(/^@/, "") : v, { key: "required" }) ?? v;
        if (f.name === "instagram") values[f.name] = String(values[f.name]).replace(/^@/, "");
        // optional file paths are stored as null when empty (their check constraints accept null, not "")
        if (f.name === "card_path" && !values[f.name]) values[f.name] = null;
        if (f.en) values[`${f.name}_en`] = check(`${f.name}_en`, text(f, "en"), clean(fd.get(`${f.name}_en`)), { key: "tooLong", values: { max: f.max } }) ?? "";
        break;
      }
      case "date":
        values[f.name] = check(f.name, f.required ? ISO_DATE : ISO_DATE.or(z.literal("")), v, { key: "badDate" }) ?? v;
        break;
      case "url":
        values[f.name] = v ? check(f.name, HTTPS_URL, v, { key: "badUrl" }) ?? null : null;
        break;
      case "number":
        values[f.name] = check(f.name, z.coerce.number().int().min(f.min).max(f.max), v === "" ? f.min : v, { key: "badNumber", values: { min: f.min, max: f.max } }) ?? f.min;
        break;
      case "select":
        values[f.name] = check(f.name, z.enum(f.options as [string, ...string[]]), v, { key: "badChoice" }) ?? f.default ?? f.options[0];
        break;
      case "checkbox":
        values[f.name] = fd.get(f.name) === "on";
        break;
      case "timeline": {
        const en = clean(fd.get(`${f.name}_en`)).split("\n").map((l) => l.trim());
        const steps: { date: string; text: string; text_en?: string }[] = [];
        v.split("\n").map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
          const [d, ...rest] = line.split("|");
          const body = rest.join("|").trim();
          if (!ISO_DATE.safeParse(d.trim()).success || !body) errors[f.name] ??= { key: "badTimeline", values: { line: i + 1 } };
          else steps.push({ date: d.trim(), text: body.slice(0, 300), ...(en[i] ? { text_en: en[i].slice(0, 300) } : {}) });
        });
        if (steps.length > 50) errors[f.name] = { key: "tooManyTimeline" };
        if (en.filter(Boolean).length > steps.length && !errors[f.name]) errors[`${f.name}_en`] = { key: "timelineEnCount" };
        values[f.name] = steps;
        break;
      }
      case "image":
        values[f.name] = v ? check(f.name, UUID, v, { key: "badImage" }) ?? null : null;
        break;
      case "images": {
        const ids = fd.getAll(f.name).map(String).filter(Boolean);
        images[f.name] = check(f.name, z.array(UUID).max(60), [...new Set(ids)], { key: "badImages" }) ?? [];
        break;
      }
    }
  }
  return { values, images, errors };
}
