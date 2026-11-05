"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { importRosterAction, type RosterState } from "@/app/actions/roster";

const INITIAL: RosterState = { ok: false };

export function RosterImport() {
  const t = useTranslations("roster");
  const [state, action, pending] = useActionState(importRosterAction, INITIAL);
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-muted">{t("format")}</p>
      <p className="rounded-xl bg-gold-soft px-4 py-2.5 text-sm text-ink">{t("replaceNote")}</p>
      <div className="space-y-2">
        <label htmlFor="roster-file" className="text-sm font-medium">{t("file")}</label>
        <input
          id="roster-file"
          name="file"
          type="file"
          accept=".csv,text/csv,text/plain"
          required
          className="block w-full rounded-xl border border-line bg-surface p-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-4 file:py-1.5 file:text-sm"
        />
      </div>
      {state.error && <p role="alert" className="rounded-xl border border-danger/30 bg-pink-soft px-4 py-3 text-sm text-danger">{t(`errors.${state.error}`, state.values)}</p>}
      {state.ok && state.done && <p role="status" className="rounded-xl bg-done/10 px-4 py-3 text-sm text-done">{t("done", { n: state.done.n, off: state.done.off })}</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-on-brand transition hover:bg-brand-mid disabled:opacity-60">
        {pending ? t("importing") : t("submit")}
      </button>
    </form>
  );
}
