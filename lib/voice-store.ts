import "server-only";
import { randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SUPABASE_URL } from "@/lib/env";
import { adminClient } from "@/lib/supabase/admin";

export type VoiceStatus = "received" | "reviewing" | "answered";
export type VoiceRecord = {
  code: string;
  category: string;
  grade: number; // 1–6 = ม.1–ม.6
  message: string;
  anonymous: boolean;
  ip_hash: string;
  status: VoiceStatus;
  reply: string | null;
  public: boolean; // never auto-published; a council member must approve
  created_at: string;
};

const DEV_FILE = path.join(process.cwd(), ".data", "voice.jsonl");
const usingSupabase = () => !!(SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// No 0/O/1/I to keep codes easy to read out loud.
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function newCode() {
  const b = randomBytes(8);
  return "UTD-" + Array.from(b.subarray(0, 6), (x) => ALPHABET[x % ALPHABET.length]).join("");
}

export function storeConfigured() {
  return usingSupabase() || process.env.NODE_ENV !== "production";
}

export async function saveVoice(rec: VoiceRecord) {
  if (usingSupabase()) {
    // service role: the public has no table access at all (RLS). Only a hash of the IP is stored.
    const { error } = await adminClient().from("voice_messages").insert({
      ref_code: rec.code,
      category: rec.category,
      grade: rec.grade,
      message: rec.message,
      anonymous: rec.anonymous,
      ip_hash: rec.ip_hash,
      status: "received",
    });
    if (error) throw new Error(`supabase insert failed: ${error.message}`);
    return;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Supabase env not set");
  await mkdir(path.dirname(DEV_FILE), { recursive: true });
  await appendFile(DEV_FILE, JSON.stringify(rec) + "\n", "utf8");
}

/** Public lookup: only status + an APPROVED council reply, never the message or hashes. */
export async function lookupVoice(code: string): Promise<{ status: VoiceStatus; reply: string | null } | null> {
  if (usingSupabase()) {
    const db = adminClient();
    const { data: msg } = await db.from("voice_messages").select("id,status").eq("ref_code", code).maybeSingle();
    if (!msg) return null;
    const { data: rep } = await db
      .from("voice_replies")
      .select("body")
      .eq("voice_id", msg.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { status: msg.status as VoiceStatus, reply: rep?.body ?? null };
  }
  try {
    const lines = (await readFile(DEV_FILE, "utf8")).split("\n").filter(Boolean);
    for (const l of lines) {
      const rec = JSON.parse(l) as VoiceRecord;
      if (rec.code === code) return { status: rec.status, reply: rec.reply };
    }
  } catch {}
  return null;
}
