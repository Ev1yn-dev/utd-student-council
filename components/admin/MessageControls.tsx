"use client";

import { Ban, LockOpen, Mail, MailOpen, Trash2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import {
  addWordsAction, blockSenderAction, deleteMessageAction, markReadAction, removeWordAction, unblockAction, type ActionState,
} from "@/app/actions/messages";
import { ICON } from "@/components/admin/icon";

const btn = "inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs font-medium transition hover:bg-surface-2 disabled:opacity-50";
const INITIAL: ActionState = { ok: false };

function ErrorText({ error }: { error?: string }) {
  const t = useTranslations("inbox.errors");
  return error ? <p role="alert" className="text-xs text-danger">{t.has(error) ? t(error) : t("failed")}</p> : null;
}

/** Read / unread, delete (two-step confirm) and block-sender controls for one message. */
export function MessageControls({ id, read, canBlock }: { id: string; read: boolean; canBlock: boolean }) {
  const t = useTranslations("inbox");
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState<string>();
  const [block, blockAction, blockPending] = useActionState(blockSenderAction, INITIAL);
  const run = (fn: () => Promise<ActionState>) =>
    start(async () => {
      try {
        const r = await fn();
        setError(r.ok ? undefined : r.error);
      } catch {
        setError("failed");
      }
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={pending} onClick={() => run(() => markReadAction(id, !read))}>
          {read ? <Mail {...ICON} /> : <MailOpen {...ICON} />}
          {read ? t("markUnread") : t("markRead")}
        </button>
        {canBlock && !block.ok && (
          <button type="button" className={btn} aria-expanded={blocking} onClick={() => setBlocking((v) => !v)}>
            <Ban {...ICON} />
            {t("block")}
          </button>
        )}
        {block.ok && <span className="rounded-full bg-danger/10 px-3 py-1 text-xs font-medium text-danger">{t("blockedOk")}</span>}
        {confirm ? (
          <>
            <button type="button" className={`${btn} border-danger bg-danger text-white hover:bg-danger/90`} disabled={pending} onClick={() => run(() => deleteMessageAction(id))}>
              <Trash2 {...ICON} />
              {t("confirmDelete")}
            </button>
            <button type="button" className={btn} onClick={() => setConfirm(false)}>{t("cancel")}</button>
          </>
        ) : (
          <button type="button" className={`${btn} text-danger`} onClick={() => setConfirm(true)}>
            <Trash2 {...ICON} />
            {t("delete")}
          </button>
        )}
      </div>
      <ErrorText error={error} />
      {blocking && !block.ok && (
        <form action={blockAction} className="grid gap-2 rounded-xl border border-line bg-surface-2 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <input type="hidden" name="messageId" value={id} />
          <label className="text-xs">
            <span className="mb-1 block text-muted">{t("blockReason")}</span>
            <input name="reason" required maxLength={500} className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm" />
          </label>
          <label className="text-xs">
            <span className="mb-1 block text-muted">{t("blockUntil")}</span>
            <input name="until" type="date" className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm" />
          </label>
          <button type="submit" disabled={blockPending} className="inline-flex items-center gap-2 rounded-full bg-danger px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">
            <Ban {...ICON} />
            {t("blockSubmit")}
          </button>
          <div className="sm:col-span-3"><ErrorText error={block.error} /></div>
        </form>
      )}
    </div>
  );
}

export function UnblockButton({ id }: { id: string }) {
  const t = useTranslations("inbox.blocks");
  const [pending, start] = useTransition();
  return (
    <button type="button" className={btn} disabled={pending} onClick={() => start(async () => void (await unblockAction(id)))}>
      <LockOpen {...ICON} />
      {t("unblock")}
    </button>
  );
}

/** The editable bad-word list: chips with remove buttons + an add form. */
export function BadWords({ words }: { words: string[] }) {
  const t = useTranslations("inbox.words");
  const [state, action, pending] = useActionState(addWordsAction, INITIAL);
  const [removing, start] = useTransition();
  return (
    <div className="space-y-3">
      {words.length ? (
        <ul className="flex flex-wrap gap-2">
          {words.map((w) => (
            <li key={w} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-sm">
              {w}
              <button type="button" disabled={removing} aria-label={t("remove", { word: w })} title={t("remove", { word: w })} className="grid h-7 w-7 place-items-center rounded-full text-muted hover:bg-line hover:text-danger" onClick={() => start(async () => void (await removeWordAction(w)))}>
                <X {...ICON} size={16} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("none")}</p>
      )}
      <form action={action} className="space-y-2">
        <textarea name="words" rows={2} placeholder={t("placeholder")} className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm" />
        <ErrorText error={state.error} />
        <button type="submit" disabled={pending} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand disabled:opacity-60">{t("add")}</button>
      </form>
    </div>
  );
}
