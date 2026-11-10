"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { reviewEntity, saveEntity, type FormState } from "@/app/actions/content";
import { DatePicker } from "@/components/admin/DatePicker";
import { addPending, removePending, toast } from "@/components/admin/live";
import { ImageField, ImagesField, PhotoPasteContext, UploadBusyContext } from "@/components/admin/PhotoFields";
import { Link, useRouter } from "@/i18n/navigation";
import type { FormPhoto } from "@/lib/admin/data";
import { ENTITIES, type EntityKey, type Field } from "@/lib/admin/entities";
import { cn } from "@/lib/utils";

const INPUT = "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-ink outline-none transition focus:border-pink aria-[invalid=true]:border-danger";
const AREA = "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-ink outline-none transition focus:border-pink aria-[invalid=true]:border-danger";
type Lang = "th" | "en";
type Section = "content" | "details" | "media" | "contact";
type Mode = "stay" | "new" | "send";
const DRAFT_MS = 3000;

/** Which card a field goes in (derived from its kind/name, so the entity config stays a flat list). */
const sectionOf = (f: Field): Section =>
  f.kind === "image" || f.kind === "images" ? "media"
  : ["instagram", "contact", "consent_public"].includes(f.name) ? "contact"
  : ["date", "number", "select", "url", "timeline", "checkbox"].includes(f.kind) ? "details"
  : "content";
const SECTIONS: Section[] = ["content", "details", "media", "contact"];

type Draft = { at: number; values: [string, string][]; media: Record<string, FormPhoto[]> };
const draftKey = (entity: string, id: string | null, year: number) => `utd-draft:${entity}:${id ?? "new"}:${year}`;
const readDraft = (k: string): Draft | null => {
  try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; }
};

/**
 * Back-office form generated from lib/admin/entities, grouped into cards.
 * - Ctrl+S saves and stays; Ctrl+Enter / main button saves and goes back to the list (staff: also publishes)
 * - "save & add another"; edit pages offer "duplicate"
 * - leaving for the list is optimistic: the list shows the row at once and a toast confirms (or reports and keeps
 *   the draft) when the server answers
 * - auto-saves a draft to localStorage every 3 s; "restore draft" after a reload or a closed tab
 * - photos: drag & drop, paste (Ctrl+V), reorder; saving waits for running uploads
 */
export function EntityForm(props: {
  entity: EntityKey; id: string | null; year: number; locale: string; staff: boolean;
  row: Record<string, unknown>; media: Record<string, FormPhoto[]>;
}) {
  const { entity, id, year } = props;
  const t = useTranslations("dashboard");
  const key = draftKey(entity, id, year);
  const [initial, setInitial] = useState({ row: props.row, media: props.media, n: 0 });
  const [draft, setDraft] = useState<Draft | null>(null);
  useEffect(() => {
    const d = readDraft(key);
    setDraft(d && d.values.length ? d : null); // eslint-disable-line react-hooks/set-state-in-effect -- browser storage, read after hydration
  }, [key]);

  const restore = () => {
    if (!draft) return;
    const row: Record<string, unknown> = { ...props.row };
    const multi = new Map<string, string[]>();
    for (const [k, v] of draft.values) multi.set(k, [...(multi.get(k) ?? []), v]);
    for (const [k, vs] of multi) row[k] = vs.length > 1 ? vs : vs[0];
    for (const f of ENTITIES[entity].fields) if (f.kind === "checkbox") row[f.name] = multi.has(f.name);
    const tl = ENTITIES[entity].fields.find((f) => f.kind === "timeline");
    if (tl && multi.has(tl.name)) row.__timelineText = { th: multi.get(tl.name)?.[0] ?? "", en: multi.get(`${tl.name}_en`)?.[0] ?? "" };
    setInitial({ row, media: draft.media, n: initial.n + 1 });
    setDraft(null);
  };
  const discard = () => {
    localStorage.removeItem(key);
    setDraft(null);
  };

  return (
    <>
      {draft && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-progress/30 bg-progress/10 px-4 py-3 text-sm">
          <span className="flex-1">{t("form.draftFound", { time: new Date(draft.at).toLocaleTimeString(props.locale === "th" ? "th-TH" : "en-GB", { hour: "2-digit", minute: "2-digit" }) })}</span>
          <button type="button" onClick={restore} className="rounded-full bg-brand px-4 py-1.5 font-semibold text-white">{t("form.restore")}</button>
          <button type="button" onClick={discard} className="rounded-full px-3 py-1.5 text-muted hover:text-danger">{t("form.discard")}</button>
        </div>
      )}
      <FormBody key={initial.n} {...props} row={initial.row} media={initial.media} draftStorageKey={key} />
    </>
  );
}

function FormBody({
  entity, id, year, locale, staff, row, media, draftStorageKey,
}: { entity: EntityKey; id: string | null; year: number; locale: string; staff: boolean; row: Record<string, unknown>; media: Record<string, FormPhoto[]>; draftStorageKey: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const reduce = useReducedMotion();
  const e = ENTITIES[entity];
  const form = useRef<HTMLFormElement>(null);
  const [lang, setLang] = useState<Lang>("th");
  const [state, setState] = useState<FormState>({ ok: false });
  const [saving, setSaving] = useState(false);
  const [busyFields, setBusyFields] = useState<Record<string, boolean>>({});
  const uploading = Object.values(busyFields).some(Boolean);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = useRef(false);
  const hasEn = e.fields.some((f) => ("en" in f && f.en) || f.kind === "timeline");
  const sendLabel = staff ? t("form.sendStaff") : t("form.send");
  const listHref = { pathname: `/admin/content/${entity}`, query: { year: String(year) } };

  // photo fields register for Ctrl+V / report upload activity
  const pasteTargets = useRef<((f: File[]) => void)[]>([]);
  const paste = useMemo(() => ({ register: (fn: (f: File[]) => void) => { pasteTargets.current.push(fn); return () => { pasteTargets.current = pasteTargets.current.filter((x) => x !== fn); }; } }), []);
  const setBusy = useCallback((name: string, busy: boolean) => setBusyFields((b) => (b[name] === busy ? b : { ...b, [name]: busy })), []);
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const files = Array.from(ev.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length && pasteTargets.current.length) {
        ev.preventDefault();
        pasteTargets.current[pasteTargets.current.length > 1 ? pasteTargets.current.length - 1 : 0](files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  // draft autosave every 3 s while there are unsaved edits
  const collectDraft = useCallback((): Draft | null => {
    if (!form.current) return null;
    const values = [...new FormData(form.current).entries()].filter((x): x is [string, string] => typeof x[1] === "string");
    const photos: Record<string, FormPhoto[]> = {};
    form.current.querySelectorAll<HTMLImageElement>("[data-photo-field] img[data-photo-id]").forEach((img) => {
      const f = img.closest<HTMLElement>("[data-photo-field]")!.dataset.photoField!;
      (photos[f] ??= []).push({ id: img.dataset.photoId!, url: img.src, pending: true });
    });
    return { at: Date.now(), values, media: photos };
  }, []);
  useEffect(() => {
    const iv = setInterval(() => {
      if (!dirty.current) return;
      const d = collectDraft();
      if (!d) return;
      try { localStorage.setItem(draftStorageKey, JSON.stringify(d)); setSavedAt(d.at); dirty.current = false; } catch { /* storage full / blocked */ }
    }, DRAFT_MS);
    return () => clearInterval(iv);
  }, [collectDraft, draftStorageKey]);

  const err = (name: string) => {
    const x = state.fieldErrors?.[name];
    return x ? t(`errors.${x.key}`, x.values) : null;
  };
  const label = (f: Field) => t(`fields.${entity}.${f.name}`);
  const hint = (f: Field) => (f.hint ? t(`hints.${entity}.${f.name}`) : null);
  const val = (name: string) => (row[name] ?? "") as string;
  const timelineText = (en: boolean) => {
    const pre = row.__timelineText as { th: string; en: string } | undefined;
    if (pre) return en ? pre.en : pre.th;
    return Array.isArray(row.timeline)
      ? (row.timeline as { date: string; text: string; text_en?: string }[]).map((s) => (en ? s.text_en ?? "" : `${s.date} | ${s.text}`)).join("\n")
      : "";
  };
  const titleOf = (fd: FormData) => String(fd.get(e.titleCol) ?? "").trim() || "…";

  async function submit(mode: Mode) {
    const el = form.current;
    if (!el || saving || uploading) return;
    if (!el.reportValidity()) return;
    const fd = new FormData(el);
    // keep the latest text as a draft until the server confirms
    const d = collectDraft();
    if (d) try { localStorage.setItem(draftStorageKey, JSON.stringify(d)); } catch { /* ignore */ }
    const msg = (s: FormState) => (s.error ? t(`errors.${s.error.key}`, s.error.values) : t("errors.saveFailed"));

    if (mode === "stay") {
      setSaving(true);
      const res = await saveEntity(entity, id, year, locale, { ok: false }, fd);
      setSaving(false);
      setState(res);
      if (!res.ok || !res.id) return;
      localStorage.removeItem(draftStorageKey);
      toast({ tone: "ok", text: t("toast.saved") });
      if (!id) router.replace({ pathname: `/admin/content/${entity}/${res.id}`, query: { year: String(year) } });
      else router.refresh();
      return;
    }

    // optimistic: show it in the list now, confirm or roll back when the server answers
    const pendingKey = crypto.randomUUID();
    addPending({ key: pendingKey, entity, year, title: titleOf(fd) });
    // start the request BEFORE navigating: a server action posts to the current URL, and the list route does not
    // carry this form's action
    const request = saveEntity(entity, id, year, locale, { ok: false }, fd);
    if (mode === "send") router.push(listHref);
    else router.push({ pathname: `/admin/content/${entity}/new`, query: { year: String(year), n: Date.now().toString(36) } });
    const res = await request.catch((err) => { console.error("[save]", err); return { ok: false } as FormState; });
    let published = false;
    if (res.ok && res.id && mode === "send" && staff) published = (await reviewEntity(entity, res.id, "approve", "")).ok;
    removePending(pendingKey);
    if (res.ok) {
      localStorage.removeItem(draftStorageKey);
      toast({ tone: "ok", text: published ? t("toast.published") : mode === "send" && !staff ? t("toast.sent") : t("toast.saved") });
    } else {
      toast({ tone: "error", text: t("toast.failed", { msg: msg(res) }), action: { label: t("toast.back"), href: id ? `/admin/content/${entity}/${id}?year=${year}` : `/admin/content/${entity}/new?year=${year}` } }, 0);
    }
    router.refresh();
  }

  // keyboard: Ctrl/Cmd+S = save (stay), Ctrl/Cmd+Enter = send
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey)) return;
      if (ev.key.toLowerCase() === "s") { ev.preventDefault(); void submitRef.current("stay"); }
      if (ev.key === "Enter") { ev.preventDefault(); void submitRef.current("send"); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function control(f: Field, name: string, lng: Lang) {
    const common = { id: name, name, "aria-invalid": !!err(name), "aria-describedby": `${name}-msg`, lang: lng };
    switch (f.kind) {
      case "text":
        return <input {...common} type="text" defaultValue={val(name)} maxLength={f.max} required={f.required && lng === "th"} className={INPUT} />;
      case "textarea":
        return <textarea {...common} defaultValue={val(name)} maxLength={f.max} rows={f.rows ?? 4} required={f.required && lng === "th"} className={AREA} />;
      case "date":
        return <DatePicker id={name} name={name} defaultValue={val(name)} required={f.required} invalid={!!err(name)} describedBy={`${name}-msg`} />;
      case "url":
        return <input {...common} type="url" inputMode="url" placeholder="https://" defaultValue={val(name)} className={INPUT} />;
      case "number":
        return <input {...common} type="number" min={f.min} max={f.max} defaultValue={String(row[name] ?? f.min)} className={cn(INPUT, "max-w-40")} />;
      case "select":
        return (
          <select {...common} defaultValue={val(name) || f.default || f.options[0]} className={INPUT}>
            {f.options.map((o) => <option key={o} value={o}>{f.labels?.[o] ? f.labels[o][locale === "en" ? "en" : "th"] : t(`options.${f.name}.${o}`)}</option>)}
          </select>
        );
      case "timeline":
        return <textarea {...common} defaultValue={timelineText(lng === "en")} rows={5} className={cn(AREA, "font-mono text-sm")} />;
      default:
        return null;
    }
  }

  function fieldBlock(f: Field) {
    if (f.kind === "image" || f.kind === "images") {
      const Comp = f.kind === "image" ? ImageField : ImagesField;
      return (
        <div key={f.name} className="space-y-1.5" data-photo-field={f.name}>
          <p className="text-sm font-semibold text-ink">{label(f)}</p>
          <Comp name={f.name} initial={media[f.name] ?? []} portrait={f.kind === "image" && f.portrait} />
          <p id={`${f.name}-msg`} className="text-xs text-danger">{err(f.name)}</p>
        </div>
      );
    }
    if (f.kind === "checkbox") {
      return (
        <label key={f.name} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2/40 p-3">
          <input type="checkbox" name={f.name} defaultChecked={!!row[f.name]} className="mt-0.5 h-5 w-5 accent-[var(--c-pink)]" />
          <span>
            <span className="text-sm font-semibold text-ink">{label(f)}</span>
            {hint(f) && <span className="block text-xs text-muted">{hint(f)}</span>}
          </span>
        </label>
      );
    }
    const bilingual = ("en" in f && f.en) || f.kind === "timeline";
    return (
      <div key={f.name}>
        {(bilingual ? (["th", "en"] as Lang[]) : (["th"] as Lang[])).map((l) => {
          const name = l === "en" ? `${f.name}_en` : f.name;
          const visible = !bilingual || l === lang;
          const h = l === "th" ? hint(f) : f.kind === "timeline" ? t("form.timelineEnHint") : null;
          return (
            <div key={l} className={cn("space-y-1.5", !visible && "hidden")}>
              <label htmlFor={name} className="flex items-center gap-2 text-sm font-semibold text-ink">
                {l === "en" ? (f.kind === "timeline" ? t("form.timelineEn") : t("form.enOf", { label: label(f) })) : label(f)}
                {"required" in f && f.required && l === "th" && <span className="rounded bg-pink-soft px-1.5 text-[0.7rem] font-semibold text-pink-ink">{t("form.required")}</span>}
              </label>
              {control(f, name, l)}
              {h && <p className="text-xs text-muted">{h}</p>}
              <p id={`${name}-msg`} className="min-h-4 text-xs font-medium text-danger">{err(name)}</p>
            </div>
          );
        })}
      </div>
    );
  }

  const bySection = SECTIONS.map((s) => [s, e.fields.filter((f) => sectionOf(f) === s)] as const).filter(([, fs]) => fs.length);

  return (
    <PhotoPasteContext.Provider value={paste}>
      <UploadBusyContext.Provider value={setBusy}>
        <form
          ref={form}
          noValidate={false}
          onSubmit={(ev) => { ev.preventDefault(); void submit("send"); }}
          onInput={() => { dirty.current = true; }}
          className="space-y-5 pb-28"
        >
          {hasEn && (
            <div className="sticky top-2 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/90 p-2 shadow-soft backdrop-blur">
              <div role="tablist" aria-label={t("form.langTabs")} className="relative grid grid-cols-2 rounded-xl bg-surface-2 p-1">
                <motion.span
                  aria-hidden
                  className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-brand shadow"
                  animate={{ x: lang === "th" ? "0%" : "100%" }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 35 }}
                />
                {(["th", "en"] as Lang[]).map((l) => (
                  <button key={l} type="button" role="tab" aria-selected={lang === l} onClick={() => setLang(l)}
                    className={cn("relative z-10 px-5 py-1.5 text-sm font-semibold transition-colors", lang === l ? "text-white" : "text-muted hover:text-ink")}>
                    {t(`form.${l}`)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">{lang === "en" ? t("form.enNote") : t("form.shortcuts", { send: sendLabel })}</p>
            </div>
          )}

          {bySection.map(([s, fields]) => (
            <section key={s} className="rounded-[20px] border border-line bg-surface p-5 shadow-soft md:p-6">
              <h2 className="mb-4 font-display text-base font-semibold text-strong">{t(`form.sections.${s}`)}</h2>
              <div className={cn("grid gap-4", s === "details" && "sm:grid-cols-2")}>{fields.map(fieldBlock)}</div>
            </section>
          ))}

          {state.error && !state.ok && <p role="alert" className="rounded-xl bg-pink-soft px-4 py-3 text-sm font-medium text-danger">{t(`errors.${state.error.key}`, state.error.values)}</p>}

          {/* sticky action bar */}
          <div className="sticky bottom-0 z-30 -mx-4 border-t border-line bg-surface/95 px-4 py-3 shadow-[0_-12px_30px_-20px_rgb(11_31_77/0.5)] backdrop-blur md:-mx-8 md:px-8">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
              <button type="submit" disabled={saving || uploading} className="rounded-full bg-pink px-6 py-2.5 font-display font-semibold text-white transition hover:shadow-glow disabled:opacity-60">
                {sendLabel}
              </button>
              <button type="button" onClick={() => void submit("stay")} disabled={saving || uploading} className="rounded-full border border-line bg-surface px-5 py-2.5 font-semibold text-ink hover:border-pink disabled:opacity-60">
                {saving ? t("form.saving") : t("form.save")}
              </button>
              <button type="button" onClick={() => void submit("new")} disabled={saving || uploading} className="rounded-full px-4 py-2.5 text-sm font-semibold text-brand-mid hover:bg-sky disabled:opacity-60">
                {t("form.saveNew")}
              </button>
              {id && (
                <Link href={{ pathname: `/admin/content/${entity}/new`, query: { year: String(year), from: id } }} className="rounded-full px-4 py-2.5 text-sm font-semibold text-muted hover:text-ink">
                  {t("form.duplicate")}
                </Link>
              )}
              <span className="ml-auto text-xs text-muted" aria-live="polite">
                {uploading ? t("image.waitUploads") : savedAt ? t("form.draftSaved", { time: new Date(savedAt).toLocaleTimeString(locale === "th" ? "th-TH" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }) : ""}
              </span>
            </div>
          </div>
        </form>
      </UploadBusyContext.Provider>
    </PhotoPasteContext.Provider>
  );
}
