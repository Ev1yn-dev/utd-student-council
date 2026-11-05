import "server-only";
import { STUDENT_ID } from "@/lib/roster-csv";
import { adminClient } from "@/lib/supabase/admin";

// Council voice moderation (migration 0017). Admin pages/actions call these only after authorize(["admin"]).
// Nothing here logs names, IDs or message text.

export type MessageRow = {
  id: string;
  ref_code: string;
  category: string;
  message: string;
  anonymous: boolean;
  status: string;
  created_at: string;
  read_at: string | null;
  flagged: boolean;
  grade: number | null;
  student_id: string | null;
  sender_prefix: string | null;
  sender_first_name: string | null;
  sender_last_name: string | null;
  sender_room: string | null;
};

export type MessageFilters = { grade?: number; room?: string; topic?: string; from?: string; to?: string; q?: string; unread?: boolean; flagged?: boolean; page: number };
export const PAGE_SIZE = 50;

const COLS = "id,ref_code,category,message,anonymous,status,created_at,read_at,flagged,grade,student_id,sender_prefix,sender_first_name,sender_last_name,sender_room";

/** Search text safe inside a quoted PostgREST or() value: syntax characters and LIKE wildcards removed. */
const searchTerm = (q: string) => q.replace(/[,()*:"'\\%_]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export async function listMessages(f: MessageFilters) {
  let query = adminClient().from("voice_messages").select(COLS, { count: "exact" }).order("created_at", { ascending: false });
  if (f.grade) query = query.eq("grade", f.grade);
  if (f.room) query = query.eq("sender_room", f.room);
  if (f.topic) query = query.eq("category", f.topic);
  if (f.from) query = query.gte("created_at", `${f.from}T00:00:00+07:00`);
  if (f.to) query = query.lte("created_at", `${f.to}T23:59:59.999+07:00`);
  if (f.unread) query = query.is("read_at", null);
  if (f.flagged) query = query.eq("flagged", true);
  const q = f.q ? searchTerm(f.q) : "";
  if (q) {
    const like = `"*${q}*"`;
    const ors = [`message.ilike.${like}`, `sender_first_name.ilike.${like}`, `sender_last_name.ilike.${like}`, `ref_code.ilike.${like}`];
    if (STUDENT_ID.test(q)) ors.push(`student_id.eq.${q}`);
    query = query.or(ors.join(","));
  }
  const fromRow = (f.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(fromRow, fromRow + PAGE_SIZE - 1);
  if (error) throw new Error(`messages: ${error.message}`);
  return { rows: (data ?? []) as MessageRow[], total: count ?? 0 };
}

/** Rooms that appear on messages (for the room filter). */
export async function messageRooms(): Promise<string[]> {
  const { data } = await adminClient().from("student_roster").select("room").eq("active", true).not("room", "is", null).limit(5000);
  const rooms = new Set((data ?? []).map((r) => String(r.room)));
  return [...rooms].sort((a, b) => a.localeCompare(b, "th", { numeric: true }));
}

export async function unreadCount(): Promise<number> {
  const { count } = await adminClient().from("voice_messages").select("id", { count: "exact", head: true }).is("read_at", null);
  return count ?? 0;
}

export async function setRead(id: string, read: boolean) {
  const { error } = await adminClient().from("voice_messages").update({ read_at: read ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(`set read: ${error.message}`);
}

export async function deleteMessage(id: string) {
  const { error } = await adminClient().from("voice_messages").delete().eq("id", id);
  if (error) throw new Error(`delete: ${error.message}`);
}

// ---- blocks ----

export type BlockRow = { id: string; student_id: string; reason: string; until: string | null; created_by: string; created_at: string };

/** The active block on a student ID (not lifted and not expired), or null. */
export async function activeBlock(studentId: string): Promise<BlockRow | null> {
  const { data, error } = await adminClient()
    .from("voice_blocks")
    .select("id,student_id,reason,until,created_by,created_at")
    .eq("student_id", studentId)
    .is("lifted_at", null)
    .or(`until.is.null,until.gt."${new Date().toISOString()}"`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`block lookup: ${error.message}`);
  return (data as BlockRow | null) ?? null;
}

/** Blocks the sender of a message. Returns the block id, or null when the message has no student ID (old anonymous). */
export async function blockSenderOf(messageId: string, reason: string, until: string | null, by: string): Promise<string | null> {
  const db = adminClient();
  const { data: msg } = await db.from("voice_messages").select("student_id").eq("id", messageId).maybeSingle();
  const sid = msg?.student_id as string | null | undefined;
  if (!sid) return null;
  const { data, error } = await db.from("voice_blocks").insert({ student_id: sid, reason, until, created_by: by }).select("id").single();
  if (error) throw new Error(`block: ${error.message}`);
  return data.id as string;
}

export async function liftBlock(id: string, by: string) {
  const { error } = await adminClient().from("voice_blocks").update({ lifted_at: new Date().toISOString(), lifted_by: by }).eq("id", id).is("lifted_at", null);
  if (error) throw new Error(`unblock: ${error.message}`);
}

/** Active blocks with the student's name from the roster (security page). */
export async function listBlocks() {
  const db = adminClient();
  const { data, error } = await db
    .from("voice_blocks")
    .select("id,student_id,reason,until,created_by,created_at")
    .is("lifted_at", null)
    .or(`until.is.null,until.gt."${new Date().toISOString()}"`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`blocks: ${error.message}`);
  const blocks = (data ?? []) as BlockRow[];
  const ids = [...new Set(blocks.map((b) => b.student_id))];
  const { data: people } = ids.length
    ? await db.from("student_roster").select("student_id,grade,room,prefix,first_name,last_name").in("student_id", ids)
    : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.student_id as string, p]));
  return blocks.map((b) => ({ ...b, person: who.get(b.student_id) ?? null }));
}

// ---- bad-word list (flags messages as "ต้องตรวจ"; they are still delivered) ----

let wordCache: { words: string[]; exp: number } | null = null;

export async function badWords(fresh = false): Promise<string[]> {
  if (!fresh && wordCache && wordCache.exp > Date.now()) return wordCache.words;
  const { data, error } = await adminClient().from("voice_bad_words").select("word").order("word");
  if (error) throw new Error(`bad words: ${error.message}`);
  const words = (data ?? []).map((r) => String(r.word));
  wordCache = { words, exp: Date.now() + 60_000 };
  return words;
}

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, "");

/** True when the message contains a listed word (spaces ignored, so "ค ำ" still matches "คำ"). */
export async function shouldFlag(message: string): Promise<boolean> {
  const words = await badWords().catch(() => []);
  const m = norm(message);
  return words.some((w) => w && m.includes(norm(w)));
}

export async function addBadWords(words: string[]) {
  const rows = [...new Set(words.map((w) => w.trim()).filter((w) => w.length >= 1 && w.length <= 60))].map((word) => ({ word }));
  if (!rows.length) return 0;
  const { error } = await adminClient().from("voice_bad_words").upsert(rows, { onConflict: "word", ignoreDuplicates: true });
  if (error) throw new Error(`add words: ${error.message}`);
  wordCache = null;
  return rows.length;
}

export async function removeBadWord(word: string) {
  const { error } = await adminClient().from("voice_bad_words").delete().eq("word", word);
  if (error) throw new Error(`remove word: ${error.message}`);
  wordCache = null;
}
