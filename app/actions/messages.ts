"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { audit, authorizePermission } from "@/lib/auth";
import { addBadWords, blockSenderOf, deleteMessage, liftBlock, removeBadWord, setRead } from "@/lib/voice-admin";

// Moderation of council voice messages. Every action re-checks its permission on the server (messages.read,
// messages.delete, senders.block); deletes, blocks and word-list changes go to admin_audit. Audit details never
// contain names, student IDs or message text.

export type ActionState = { ok: boolean; error?: string };

const uuid = z.string().uuid();

export async function markReadAction(id: string, read: boolean): Promise<ActionState> {
  const s = await authorizePermission("messages.read");
  if (!s) return { ok: false, error: "forbidden" };
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  await setRead(id, read);
  refresh();
  return { ok: true };
}

export async function deleteMessageAction(id: string): Promise<ActionState> {
  const s = await authorizePermission("messages.delete");
  if (!s) return { ok: false, error: "forbidden" };
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  await deleteMessage(id);
  await audit(s, "message.delete", `voice_messages:${id}`);
  refresh();
  return { ok: true };
}

const blockSchema = z.object({
  messageId: uuid,
  reason: z.string().trim().min(1, "reason").max(500, "reason"),
  until: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "until")]),
});

export async function blockSenderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await authorizePermission("senders.block");
  if (!s) return { ok: false, error: "forbidden" };
  const p = blockSchema.safeParse({ messageId: fd.get("messageId"), reason: fd.get("reason") ?? "", until: fd.get("until") ?? "" });
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message === "until" ? "until" : "reason" };
  // an end date blocks until the end of that day (Bangkok)
  const until = p.data.until ? `${p.data.until}T23:59:59+07:00` : null;
  if (until && new Date(until) < new Date()) return { ok: false, error: "until" };
  const blockId = await blockSenderOf(p.data.messageId, p.data.reason, until, s.email);
  if (!blockId) return { ok: false, error: "noSender" };
  await audit(s, "sender.block", `voice_blocks:${blockId}`, { message: p.data.messageId, until });
  refresh();
  return { ok: true };
}

export async function unblockAction(id: string): Promise<ActionState> {
  const s = await authorizePermission("senders.block");
  if (!s) return { ok: false, error: "forbidden" };
  if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
  await liftBlock(id, s.email);
  await audit(s, "sender.unblock", `voice_blocks:${id}`);
  refresh();
  return { ok: true };
}

export async function addWordsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const s = await authorizePermission("senders.block");
  if (!s) return { ok: false, error: "forbidden" };
  const words = String(fd.get("words") ?? "").split(/[\n,]/).slice(0, 200);
  const n = await addBadWords(words);
  if (!n) return { ok: false, error: "empty" };
  await audit(s, "words.add", "voice_bad_words", { count: n });
  refresh();
  return { ok: true };
}

export async function removeWordAction(word: string): Promise<ActionState> {
  const s = await authorizePermission("senders.block");
  if (!s) return { ok: false, error: "forbidden" };
  await removeBadWord(String(word).slice(0, 60));
  await audit(s, "words.remove", "voice_bad_words");
  refresh();
  return { ok: true };
}
