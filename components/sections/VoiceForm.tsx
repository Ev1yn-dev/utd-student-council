"use client";

import Script from "next/script";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { submitVoice, type VoiceState } from "@/app/actions/voice";
import { Button } from "@/components/ui/Button";
import { VOICE_CATEGORIES, VOICE_GRADES } from "@/lib/site";

const INITIAL: VoiceState = { ok: false };
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Five Kae Farang petals bloom when the message is sent. */
function Bloom() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="-50 -50 100 100" className="mx-auto h-28 w-28" aria-hidden>
      {[0, 72, 144, 216, 288].map((a, i) => (
        <motion.ellipse
          key={a}
          cx={0}
          cy={-22}
          rx={11}
          ry={20}
          fill="var(--c-pink)"
          opacity={0.9}
          style={{ transformOrigin: "0px 0px", rotate: a }}
          initial={reduce ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.9 }}
          transition={{ type: "spring", stiffness: 160, damping: 14, delay: i * 0.1 }}
        />
      ))}
      <circle r={7} fill="var(--c-gold)" />
    </svg>
  );
}

export function VoiceForm() {
  const t = useTranslations("voice");
  const te = useTranslations("voice.errors");
  const err = (k?: string, v?: Record<string, number>) => (k ? te(k, v) : undefined);
  const [state, action, pending] = useActionState(submitVoice, INITIAL);

  if (state.ok) {
    return (
      <div className="space-y-4 rounded-lg border border-line bg-page p-10 text-center" role="status">
        <Bloom />
        <h3 className="text-2xl font-semibold">{t("done")}</h3>
        <p className="text-muted">{t("keep")}</p>
        <p className="font-display text-3xl font-semibold tracking-wider text-pink-ink" aria-label={t("refAria", { code: state.code ?? "" })}>{state.code}</p>
      </div>
    );
  }

  const input = "w-full rounded-md border-[1.5px] border-line bg-surface px-4 py-3 text-ink placeholder:text-muted focus:border-pink";
  return (
    <form data-swap action={action} className="space-y-5 rounded-lg border border-line bg-page p-6 shadow-soft md:p-10" noValidate>
      {SITE_KEY && <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />}
      <div>
        <h2 className="text-3xl font-semibold">{t("formTitle")}</h2>
        <p className="mt-1 text-muted">{t("formSub")}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="category" className="text-sm font-medium">{t("category")}</label>
        <select id="category" name="category" defaultValue="" className={input} aria-invalid={!!state.fieldErrors?.category} aria-describedby="category-err">
          <option value="" disabled>{t("choose")}</option>
          {Object.entries(VOICE_CATEGORIES).map(([value, key]) => <option key={value} value={value}>{t(`categories.${key}`)}</option>)}
        </select>
        <p id="category-err" className="text-sm text-danger">{err(state.fieldErrors?.category)}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="grade" className="text-sm font-medium">{t("grade")}</label>
        <select id="grade" name="grade" defaultValue="" className={input} aria-invalid={!!state.fieldErrors?.grade} aria-describedby="grade-err">
          <option value="" disabled>{t("chooseGrade")}</option>
          {VOICE_GRADES.map((g) => <option key={g} value={g}>{t("gradeLabel", { g })}</option>)}
        </select>
        <p id="grade-err" className="text-sm text-danger">{err(state.fieldErrors?.grade)}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="message" className="text-sm font-medium">{t("message")}</label>
        <textarea id="message" name="message" rows={6} maxLength={1000} placeholder={t("placeholder")} className={input} aria-invalid={!!state.fieldErrors?.message} aria-describedby="message-err" />
        <p id="message-err" className="text-sm text-danger">{err(state.fieldErrors?.message)}</p>
      </div>

      <label className="flex items-center gap-3">
        <input type="checkbox" name="anonymous" defaultChecked className="h-5 w-5 accent-[var(--c-pink)]" />
        <span>{t("anonymous")}</span>
      </label>

      {/* honeypot — hidden from people, bots fill it */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>{t("honeypot")} <input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {SITE_KEY && <div className="cf-turnstile" data-sitekey={SITE_KEY} data-theme="light" />}

      {state.error && <p role="alert" className="rounded-md bg-pink-soft px-4 py-3 text-ink">{err(state.error, state.errorValues)}</p>}

      <Button type="submit" disabled={pending} className="w-full">{pending ? t("sending") : t("submit")}</Button>
    </form>
  );
}
