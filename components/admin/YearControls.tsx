"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { addYear, setCurrentYear, type FormState } from "@/app/actions/content";
import { useRouter } from "@/i18n/navigation";
import { ceYear } from "@/lib/utils";

export function SetCurrentButton({ year }: { year: number }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await setCurrentYear(year);
          if (r.ok) router.refresh();
          else setError(t(`errors.${r.error.key}`, r.error.values));
        })}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-pink hover:text-pink-ink disabled:opacity-50"
      >
        {t("years.setCurrent")}
      </button>
    </span>
  );
}

export function AddYearForm({ years, suggested }: { years: number[]; suggested: number }) {
  const t = useTranslations("dashboard");
  const ty = useTranslations("year");
  const [state, action, pending] = useActionState<FormState, FormData>(addYear, { ok: false });
  const yearErr = state.fieldErrors?.year;
  return (
    <form action={action} className="space-y-4 rounded-[20px] border border-line bg-surface p-5 shadow-soft">
      <h2 className="font-display text-lg font-semibold text-strong">{t("years.add")}</h2>
      <div className="flex flex-wrap gap-4">
        <label className="space-y-1 text-sm font-medium text-ink">
          {t("years.year")}
          <input name="year" type="number" min={2500} max={2700} defaultValue={suggested} aria-invalid={!!yearErr} className="block w-40 rounded-xl border border-line bg-surface px-3 py-2 aria-[invalid=true]:border-danger" />
        </label>
        <label className="space-y-1 text-sm font-medium text-ink">
          {t("years.copyFrom")}
          <select name="copyFrom" defaultValue={years[0] ?? ""} className="block w-56 rounded-xl border border-line bg-surface px-3 py-2">
            <option value="">{t("years.noCopy")}</option>
            {years.map((y) => <option key={y} value={y}>{ty("option", { be: y, ce: ceYear(y) })}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-muted">{t("years.copyHint")}</p>
      {yearErr && <p role="alert" className="text-sm text-danger">{t(`errors.${yearErr.key}`)}</p>}
      {state.error && <p role="alert" className="text-sm text-danger">{t(`errors.${state.error.key}`, state.error.values)}</p>}
      {state.ok && <p role="status" className="text-sm text-done">{t("years.added")}</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-pink px-5 py-2.5 font-display font-semibold text-white hover:shadow-glow disabled:opacity-60">
        {t("years.add")}
      </button>
    </form>
  );
}
