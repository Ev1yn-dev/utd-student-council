"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ensureGate } from "@/lib/gate-client";

type Status = "received" | "reviewing" | "answered";
type ErrKey = "notFound" | "tooMany" | "badCode" | "generic";
type Result = { status: Status; reply: string | null } | { error: ErrKey } | null;

/** Looks up a submission by reference code. Fetches a short-lived signed token first. */
export function VoiceTracker() {
  const t = useTranslations("voice");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRes(null);
    try {
      await ensureGate(); // /api needs the gate cookie
      const t = await fetch("/api/token", { cache: "no-store" });
      if (!t.ok) throw new Error("token");
      const { token } = (await t.json()) as { token: string };
      const r = await fetch(`/api/voice/status?code=${encodeURIComponent(code.trim().toUpperCase())}`, { headers: { "x-utd-token": token }, cache: "no-store" });
      if (r.status === 404) setRes({ error: "notFound" });
      else if (r.status === 429) setRes({ error: "tooMany" });
      else if (!r.ok) setRes({ error: "badCode" });
      else setRes(await r.json());
    } catch {
      setRes({ error: "generic" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form data-swap onSubmit={lookup} className="space-y-4 rounded-lg border border-line bg-page p-6 md:p-8">
      <h3 className="text-xl font-semibold">{t("trackTitle")}</h3>
      <div className="flex flex-wrap gap-3">
        <label htmlFor="ref-code" className="sr-only">{t("refLabel")}</label>
        <input id="ref-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="UTD-XXXXXX" maxLength={10} className="min-w-0 flex-1 rounded-md border-[1.5px] border-line bg-surface px-4 py-3 uppercase placeholder:text-muted" />
        <Button type="submit" disabled={busy || code.trim().length < 6}>{busy ? t("checking") : t("check")}</Button>
      </div>
      <div aria-live="polite">
        {res && "error" in res && <p className="text-danger">{t(`errors.${res.error}`)}</p>}
        {res && "status" in res && (
          <p>
            {t("status")} <strong>{t(`statuses.${res.status}`)}</strong>
            {res.reply && <span className="mt-2 block rounded-md bg-pink-soft p-4">{t("reply")} {res.reply}</span>}
          </p>
        )}
      </div>
    </form>
  );
}
