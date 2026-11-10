"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deletePhoto, setHero } from "@/app/actions/content";
import { useRouter } from "@/i18n/navigation";

type P = { id: string; caption: string; isHero: boolean; order: number; start: string; end: string; url: string; credit: "school" | "council" | null };

export function HeroRow({ photo }: { photo: P }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [on, setOn] = useState(photo.isHero);
  const [order, setOrder] = useState(photo.order);
  const [from, setFrom] = useState(photo.start);
  const [until, setUntil] = useState(photo.end);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- approved variant (public bucket or public/banner) */}
        <img src={photo.url} alt={photo.caption} className="aspect-[16/9] w-full object-cover" />
        {photo.credit && <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[0.7rem] text-white">{t(photo.credit === "school" ? "hero.schoolCredit" : "hero.councilCredit")}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3 p-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-5 w-5 accent-[var(--c-pink)]" />
          {t("hero.show")}
        </label>
        <label className="flex items-center gap-2">
          {t("hero.order")}
          <input type="number" min={0} max={999} value={order} onChange={(e) => setOrder(Number(e.target.value))} className="w-20 rounded-lg border border-line px-2 py-1" />
        </label>
        <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted">
          <span>{t("hero.window")}</span>
          <input type="date" aria-label={t("hero.start")} value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-line px-2 py-1 text-ink" />
          <span aria-hidden>–</span>
          <input type="date" aria-label={t("hero.end")} value={until} onChange={(e) => setUntil(e.target.value)} className="rounded-lg border border-line px-2 py-1 text-ink" />
          <span>{t("hero.windowHint")}</span>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => {
            const r = await setHero(photo.id, on, order, from, until);
            setMsg(r.ok ? { ok: true, text: t("hero.saved") } : { ok: false, text: t(`errors.${r.error.key}`, r.error.values) });
            if (r.ok) router.refresh();
          })}
          className="ml-auto rounded-full bg-brand px-4 py-1.5 font-semibold text-white disabled:opacity-50"
        >
          {t("hero.save")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm(t("hero.confirmDelete")) && start(async () => {
            const r = await deletePhoto(photo.id);
            if (r.ok) router.refresh();
            else setMsg({ ok: false, text: t(`errors.${r.error.key}`, r.error.values) });
          })}
          className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted hover:text-danger disabled:opacity-50"
        >
          {t("hero.delete")}
        </button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "w-full text-done" : "w-full text-danger"}>{msg.text}</p>}
      </div>
    </li>
  );
}
