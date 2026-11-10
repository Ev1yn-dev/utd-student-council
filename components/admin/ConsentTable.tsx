"use client";

import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { setIgConsent, setIgConsentAll, setPhotoConsent, setPhotoConsentAll } from "@/app/actions/content";
import { toast } from "@/components/admin/live";
import { useRouter } from "@/i18n/navigation";
import type { ConsentRow } from "@/lib/admin/consent";
import { cn } from "@/lib/utils";

const TONE = { pending: "bg-progress/15 text-progress", yes: "bg-done/12 text-done", no: "bg-danger/10 text-danger" };

export function ConsentTable({ year, rows }: { year: number; rows: ConsentRow[] }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  const state = (c: ConsentRow["consent"]) => (c === true ? "yes" : c === false ? "no" : "pending");

  const run = (fn: () => Promise<{ ok: boolean; error?: { key: string; values?: Record<string, number> } }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast({ tone: "ok", text: t("consent.saved") });
        router.refresh();
      } else toast({ tone: "error", text: t(`errors.${r.error!.key}`, r.error!.values) });
    });

  // two separate confirmations; the server also checks the confirmed count
  const all = () => {
    if (!confirm(t("consent.confirm1", { n: rows.length }))) return;
    if (!confirm(t("consent.confirm2"))) return;
    run(() => setPhotoConsentAll(year, rows.length));
  };
  const withIg = rows.filter((r) => r.instagram).length;
  const allIg = () => {
    if (!confirm(t("consent.igConfirm1", { n: withIg }))) return;
    if (!confirm(t("consent.igConfirm2"))) return;
    run(() => setIgConsentAll(year, withIg));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={pending || !withIg} onClick={allIg} className="rounded-full border border-brand px-4 py-2 text-sm font-semibold text-brand disabled:opacity-50">
          {t("consent.igAll")}
        </button>
        <button type="button" disabled={pending || !rows.length} onClick={all} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {t("consent.all")}
        </button>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[20px] border border-line bg-surface">
        {rows.map((r) => {
          const s = state(r.consent);
          return (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              {r.preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- 10-minute signed preview from the private bucket
                <img src={r.preview} alt="" width={44} height={55} className="h-[55px] w-[44px] shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="grid h-[55px] w-[44px] shrink-0 place-items-center rounded-lg bg-surface-2 text-[0.6rem] text-muted">{t("consent.noPhoto")}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-strong">{r.order}. {r.name}</p>
                <p className="truncate text-xs text-muted">{r.role}</p>
                {r.nameFromPoster && <p className="text-xs text-progress">{t("consent.review", { poster: r.nameFromPoster })}</p>}
                {r.roleFromDoc && <p className="text-xs text-progress">{t("consent.reviewRole", { role: r.roleFromDoc })}</p>}
                {r.instagram && <p className="text-xs text-muted">IG @{r.instagram}</p>}
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[s])}>{t(`consent.${s}`)}</span>
              <div className="flex gap-1.5">
                <button type="button" disabled={pending || r.consent === true || !r.photoKey} onClick={() => run(() => setPhotoConsent(r.id, true))} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-sky disabled:opacity-40">
                  {t("consent.on")}
                </button>
                <button type="button" disabled={pending || r.consent === false} onClick={() => run(() => setPhotoConsent(r.id, false))} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-pink-soft disabled:opacity-40">
                  {t("consent.off")}
                </button>
              </div>
              {r.instagram && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.igOn}
                  disabled={pending}
                  onClick={() => run(() => setIgConsent(r.id, !r.igOn))}
                  className={cn("rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40", r.igOn ? "border-done bg-done/12 text-done" : "border-line hover:bg-sky")}
                >
                  {t(r.igOn ? "consent.igOff" : "consent.igOn")}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
