"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { limit } from "@/lib/ratelimit";
import { clientIp, hashIp } from "@/lib/security";
import { newCode, saveVoice, storeConfigured } from "@/lib/voice-store";
import { VOICE_CATEGORY_VALUES } from "@/lib/site";

const schema = z.object({
  category: z.enum(VOICE_CATEGORY_VALUES, { message: "pickCategory" }),
  grade: z.coerce.number({ message: "pickGrade" }).int("pickGrade").min(1, "pickGrade").max(6, "pickGrade"),
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
  fieldErrors?: Partial<Record<"category" | "grade" | "message", string>>;
};

async function verifyTurnstile(token: string | null, ip: string) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) return process.env.NODE_ENV !== "production"; // skipped in dev, fail closed in production
  if (!token) return false;
  const body = new URLSearchParams({ secret: secretKey, response: token, remoteip: ip });
  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body, cache: "no-store" });
  const j = (await r.json()) as { success?: boolean };
  return j.success === true;
}

export async function submitVoice(_prev: VoiceState, fd: FormData): Promise<VoiceState> {
  const ip = clientIp(await headers());

  const rl = await limit("form", ip);
  if (!rl.ok) return { ok: false, error: "rate", errorValues: { min: Math.ceil(rl.retryAfter / 60) } };

  const parsed = schema.safeParse({
    category: fd.get("category"),
    grade: fd.get("grade") || undefined,
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
      if (k === "category" || k === "grade" || k === "message") fieldErrors[k] ??= i.message;
    }
    return { ok: false, fieldErrors };
  }

  if (!(await verifyTurnstile(fd.get("cf-turnstile-response") as string | null, ip))) {
    return { ok: false, error: "captcha" };
  }
  if (!storeConfigured()) return { ok: false, error: "notReady" };

  const code = newCode();
  try {
    await saveVoice({
      code,
      category: parsed.data.category,
      grade: parsed.data.grade,
      message: parsed.data.message,
      anonymous: parsed.data.anonymous,
      ip_hash: hashIp(ip),
      status: "received",
      reply: null,
      public: false,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[voice] save failed", e);
    return { ok: false, error: "save" };
  }
  return { ok: true, code };
}
