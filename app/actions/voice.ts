"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { limit } from "@/lib/ratelimit";
import { rosterOpen, studentGrade } from "@/lib/roster";
import { clientIp, hashIp, studentHash, voiceMessageHash } from "@/lib/security";
import { VOICE_CATEGORY_VALUES } from "@/lib/site";
import { adminClient } from "@/lib/supabase/admin";
import { newCode, saveVoice, storeConfigured } from "@/lib/voice-store";

const PER_STUDENT_PER_DAY = 3;

const schema = z.object({
  // wrong format and unknown ID give the same message (nothing tells whether an ID exists)
  studentId: z.string().trim().regex(/^[0-9]{5}$/, "studentNotFound"),
  category: z.enum(VOICE_CATEGORY_VALUES, { message: "pickCategory" }),
  message: z.string().trim().min(10, "short").max(1000, "long"),
  anonymous: z.boolean(),
  website: z.string().max(0), // honeypot: real users leave it empty
});

// error / fieldErrors are message keys under voice.errors (the form translates them)
export type VoiceState = {
  ok: boolean;
  code?: string;
  error?: string;
  errorValues?: Record<string, number>;
  fieldErrors?: Partial<Record<"studentId" | "category" | "message", string>>;
};

async function verifyTurnstile(token: string | null, ip: string) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return process.env.NODE_ENV !== "production"; // skipped in dev, fail closed in production
  if (!token) return false;
  const body = new URLSearchParams({ secret: secretKey, response: token, remoteip: ip });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
  const j = (await r.json()) as { success?: boolean; "error-codes"?: string[] };
  if (!j.success) console.warn("[voice] turnstile rejected", j["error-codes"]?.join(",") ?? "");
  return j.success === true;
}

/** Whether the form accepts submissions (a student roster has been imported). */
export async function voiceOpen(): Promise<boolean> {
  return storeConfigured() && (await rosterOpen());
}

export async function submitVoice(_prev: VoiceState, fd: FormData): Promise<VoiceState> {
  const ip = clientIp(await headers());

  const rl = await limit("form", ip);
  if (!rl.ok) return { ok: false, error: "rate", errorValues: { min: Math.ceil(rl.retryAfter / 60) } };

  const parsed = schema.safeParse({
    studentId: fd.get("studentId") ?? "",
    category: fd.get("category"),
    message: fd.get("message"),
    anonymous: fd.get("anonymous") === "on",
    website: fd.get("website") ?? "",
  });
  if (!parsed.success) {
    // honeypot filled -> pretend success so bots learn nothing
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { ok: true, code: newCode() };
    const fieldErrors: VoiceState["fieldErrors"] = {};
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (k === "studentId" || k === "category" || k === "message") fieldErrors[k] ??= i.message;
    }
    return { ok: false, fieldErrors };
  }

  if (!(await verifyTurnstile(fd.get("cf-turnstile-response") as string | null, ip))) {
    return { ok: false, error: "captcha" };
  }
  if (!(await voiceOpen())) return { ok: false, error: "closed" };

  const { studentId, category, message, anonymous } = parsed.data;
  try {
    // the grade comes from the roster, never from the form
    const grade = await studentGrade(studentId);
    if (!grade) return { ok: false, fieldErrors: { studentId: "studentNotFound" } };

    const { data: claim, error } = await adminClient().rpc("voice_claim", {
      p_student_hash: studentHash(studentId),
      p_msg_hash: voiceMessageHash(studentId, message),
      p_max: PER_STUDENT_PER_DAY,
    });
    if (error) throw new Error(`voice_claim: ${error.message}`);
    if (claim === "limit") return { ok: false, error: "studentLimit", errorValues: { max: PER_STUDENT_PER_DAY } };
    if (claim === "dup") return { ok: false, error: "duplicate" };

    const code = newCode();
    await saveVoice({
      code,
      category,
      grade,
      // the raw ID is kept only when the student chose to be named; an anonymous message has no link to a student
      student_id: anonymous ? null : studentId,
      message,
      anonymous,
      ip_hash: hashIp(ip),
      status: "received",
      reply: null,
      public: false,
      created_at: new Date().toISOString(),
    });
    return { ok: true, code };
  } catch (e) {
    console.error("[voice] save failed", e);
    return { ok: false, error: "save" };
  }
}
