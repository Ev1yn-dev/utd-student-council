"use client";

import imageCompression from "browser-image-compression";
import { Reorder } from "motion/react";
import { useTranslations } from "next-intl";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createUploadUrl, finalizeUpload } from "@/app/actions/content";
import { IconClose, IconImages, IconReset } from "@/components/icons/Icon";
import type { FormPhoto } from "@/lib/admin/data";
import { sniffImage } from "@/lib/image-sniff";
import { cn } from "@/lib/utils";

// Fast upload: compress in the browser (WebP, <= 1920 px) -> PUT straight to Supabase Storage with a one-time signed
// URL (progress via XHR, cancellable) -> finalize (row inserted at once, variants built in the background on the
// server). Three files upload at the same time.

const CONCURRENCY = 3;
const ACCEPT = "image/jpeg,image/png,image/webp";

type Status = "queued" | "compressing" | "uploading" | "finalizing" | "done" | "error";
type Item = { key: string; file?: File; status: Status; progress: number; id?: string; url: string; pending: boolean; error?: string };

/** Lets the form route Ctrl+V / dropped images to a photo field. */
export const PhotoPasteContext = createContext<{ register: (fn: (files: File[]) => void) => () => void } | null>(null);
/** Lets the form know whether uploads are still running (save waits / is blocked). */
export const UploadBusyContext = createContext<((key: string, busy: boolean) => void) | null>(null);

function putWithProgress(url: string, file: Blob, onProgress: (p: number) => void, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("content-type", "image/webp");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload ${xhr.status}`)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

function usePhotoQueue(initial: FormPhoto[], max: number) {
  const t = useTranslations("dashboard");
  const [items, setItems] = useState<Item[]>(() => initial.map((p) => ({ key: p.id, status: "done", progress: 0, id: p.id, url: p.url, pending: p.pending })));
  // queue bookkeeping lives in refs (not render state): files waiting/running, how many run, abort handles
  const files = useRef(new Map<string, File>());
  const queue = useRef<string[]>([]);
  const running = useRef(0);
  const aborts = useRef(new Map<string, AbortController>());
  const count = useRef(items.length);
  useEffect(() => { count.current = items.length; }, [items.length]);

  const patch = (key: string, p: Partial<Item>) => setItems((l) => l.map((i) => (i.key === key ? { ...i, ...p } : i)));

  async function run(key: string) {
    const file = files.current.get(key);
    if (!file) return next();
    const ac = new AbortController();
    aborts.current.set(key, ac);
    try {
      patch(key, { status: "compressing", progress: 0, error: undefined });
      // real image? (a renamed .html/.svg is refused here; the server checks the uploaded bytes again)
      if (!sniffImage(new Uint8Array(await file.slice(0, 16).arrayBuffer()))) throw new Error(t("errors.badFile"));
      const small = await imageCompression(file, { maxWidthOrHeight: 1920, fileType: "image/webp", initialQuality: 0.85, useWebWorker: false, signal: ac.signal });
      const bmp = await createImageBitmap(small);
      const { width, height } = bmp;
      bmp.close();
      const u = await createUploadUrl();
      if (!u.ok) throw new Error(t(`errors.${u.error.key}`, u.error.values));
      if (!u.id || !u.url) throw new Error(t("image.failed"));
      patch(key, { status: "uploading" });
      await putWithProgress(u.url, small, (p) => patch(key, { progress: p }), ac.signal);
      patch(key, { status: "finalizing", progress: 100 });
      const fin = await finalizeUpload(u.id, width, height);
      if (!fin.ok) throw new Error(t(`errors.${fin.error.key}`, fin.error.values));
      files.current.delete(key);
      patch(key, { status: "done", id: u.id, pending: true });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("[upload]", err);
        const msg = (err as Error).message;
        patch(key, { status: "error", error: msg && !/^(network|upload d+)$/.test(msg) ? msg : t("image.failed") });
      }
    } finally {
      aborts.current.delete(key);
      running.current--;
      next();
    }
  }
  function next() {
    while (running.current < CONCURRENCY && queue.current.length) {
      running.current++;
      void run(queue.current.shift()!);
    }
  }
  function add(list: File[]) {
    const images = list.filter((f) => ACCEPT.includes(f.type));
    if (!images.length) return;
    const take = max === 1 ? images.slice(0, 1) : images.slice(0, Math.max(0, max - count.current));
    const fresh: Item[] = take.map((file) => {
      const key = crypto.randomUUID();
      files.current.set(key, file);
      return { key, status: "queued" as const, progress: 0, url: URL.createObjectURL(file), pending: true };
    });
    if (max === 1) aborts.current.forEach((a) => a.abort());
    setItems((l) => (max === 1 ? fresh : [...l, ...fresh]));
    queue.current.push(...fresh.map((i) => i.key));
    next();
  }
  function remove(key: string) {
    aborts.current.get(key)?.abort();
    files.current.delete(key);
    queue.current = queue.current.filter((k) => k !== key);
    setItems((l) => l.filter((i) => i.key !== key));
  }
  function retry(key: string) {
    patch(key, { status: "queued", progress: 0, error: undefined });
    queue.current.push(key);
    next();
  }
  useEffect(() => {
    const a = aborts.current;
    return () => a.forEach((x) => x.abort());
  }, []);
  return { items, setItems, add, remove, retry, busy: items.some((i) => i.status !== "done" && i.status !== "error") };
}

function Tile({ item, portrait, onRemove, onRetry }: { item: Item; portrait?: boolean; onRemove: () => void; onRetry: () => void }) {
  const t = useTranslations("dashboard.image");
  const label = item.status === "compressing" ? t("compressing") : item.status === "uploading" ? t("progress", { p: item.progress }) : item.status === "finalizing" ? t("finalizing") : item.status === "queued" ? t("compressing") : null;
  return (
    <div className={cn("group/tile relative overflow-hidden rounded-xl border border-line bg-surface-2", portrait ? "aspect-[3/4] w-32" : "aspect-[4/3] w-40")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL or signed preview */}
      <img src={item.url} alt="" draggable={false} data-photo-id={item.status === "done" ? item.id : undefined} className={cn("h-full w-full object-cover", item.status !== "done" && "opacity-60")} />
      {item.status === "done" && item.pending && <span className="absolute left-1.5 top-1.5 rounded-full bg-progress px-2 py-0.5 text-[0.65rem] font-semibold text-white">{t("pending")}</span>}
      {label && (
        <div className="absolute inset-x-0 bottom-0 bg-brand-deep/70 px-2 pb-1.5 pt-1 text-[0.7rem] font-medium text-white">
          {label}
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-pink transition-[width]" style={{ width: `${item.progress}%` }} /></div>
        </div>
      )}
      {item.status === "error" && (
        <div className="absolute inset-0 grid place-items-center bg-danger/80 p-2 text-center text-[0.7rem] font-medium text-white">
          <span>{item.error}</span>
          <button type="button" onClick={onRetry} className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-danger"><IconReset width={12} /> {t("retry")}</button>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={item.status === "done" || item.status === "error" ? t("remove") : t("cancel")}
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-brand-deep/70 text-white backdrop-blur hover:bg-brand-deep"
      >
        <IconClose width={14} />
      </button>
    </div>
  );
}

function DropZone({ multiple, onFiles, busy, children }: { multiple?: boolean; onFiles: (f: File[]) => void; busy: boolean; children?: React.ReactNode }) {
  const t = useTranslations("dashboard.image");
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
      className={cn("rounded-2xl border-2 border-dashed p-3 transition-colors", over ? "border-pink bg-pink-soft/60" : "border-line bg-surface-2/50")}
    >
      {children}
      <input ref={input} type="file" accept={ACCEPT} multiple={multiple} className="sr-only" tabIndex={-1} onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-brand-mid hover:bg-sky"
        aria-busy={busy}
      >
        <IconImages width={18} /> {t("drop")}
      </button>
      <p className="px-1 text-center text-xs text-muted">{t("formats")}</p>
    </div>
  );
}

function useFieldWiring(name: string, add: (f: File[]) => void, busy: boolean) {
  const paste = useContext(PhotoPasteContext);
  const setBusy = useContext(UploadBusyContext);
  const addRef = useRef(add);
  useEffect(() => { addRef.current = add; });
  useEffect(() => paste?.register((f) => addRef.current(f)), [paste]);
  useEffect(() => setBusy?.(name, busy), [setBusy, name, busy]);
}

/** One photo stored in a photos.id column of the row. */
export function ImageField({ name, initial, portrait }: { name: string; initial: FormPhoto[]; portrait?: boolean }) {
  const q = usePhotoQueue(initial, 1);
  useFieldWiring(name, q.add, q.busy);
  const done = q.items.find((i) => i.status === "done");
  return (
    <DropZone onFiles={q.add} busy={q.busy}>
      <input type="hidden" name={name} value={done?.id ?? ""} />
      {q.items.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {q.items.map((i) => <Tile key={i.key} item={i} portrait={portrait} onRemove={() => q.remove(i.key)} onRetry={() => q.retry(i.key)} />)}
        </div>
      )}
    </DropZone>
  );
}

/** Ordered gallery linked to the row (photos.<fk>); order = position (drag to reorder). */
export function ImagesField({ name, initial }: { name: string; initial: FormPhoto[]; portrait?: boolean }) {
  const t = useTranslations("dashboard.image");
  const q = usePhotoQueue(initial, 60);
  useFieldWiring(name, q.add, q.busy);
  return (
    <DropZone multiple onFiles={q.add} busy={q.busy}>
      {q.items.filter((i) => i.status === "done" && i.id).map((i) => <input key={i.key} type="hidden" name={name} value={i.id} />)}
      {q.items.length > 0 && (
        <>
          <Reorder.Group axis="x" values={q.items} onReorder={q.setItems} className="flex flex-wrap gap-3" aria-label={t("dragToSort")}>
            {q.items.map((i) => (
              <Reorder.Item key={i.key} value={i} className="cursor-grab active:cursor-grabbing" whileDrag={{ scale: 1.05, zIndex: 10 }}>
                <Tile item={i} onRemove={() => q.remove(i.key)} onRetry={() => q.retry(i.key)} />
              </Reorder.Item>
            ))}
          </Reorder.Group>
          {q.items.length > 1 && <p className="mt-1 px-1 text-xs text-muted">{t("dragToSort")}</p>}
        </>
      )}
    </DropZone>
  );
}
