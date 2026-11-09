"use client";

import { AnimatePresence, m, useReducedMotion, type PanInfo } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Img } from "@/lib/content";
import { SmartImage } from "@/components/ui/SmartImage";
import { IconChevronLeft, IconChevronRight, IconClose, IconExpand } from "@/components/icons/Icon";
import { useScrollLock } from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

const SWIPE = 60;

/** Swipe/drag, arrows, dots and a thumbnail strip that follows; "expand" opens a full-screen viewer. */
export function Gallery({ photos, alt, aspect = "aspect-[16/10]" }: { photos: (Img | null)[]; alt: string; aspect?: string }) {
  const t = useTranslations("gallery");
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const [full, setFull] = useState(false);
  const n = photos.length;
  const go = (to: number) => {
    setDir(to > i ? 1 : -1);
    setI(((to % n) + n) % n);
  };
  if (n === 0) return null;
  return (
    <div className="space-y-3">
      <Stage photos={photos} alt={alt} i={i} dir={dir} go={go} className={cn("rounded-[18px]", aspect)}>
        <button
          type="button"
          onClick={() => setFull(true)}
          aria-label={t("full")}
          className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full bg-brand-deep/55 text-white backdrop-blur transition hover:scale-105 hover:bg-brand-deep/75"
        >
          <IconExpand />
        </button>
      </Stage>
      {n > 1 && <Thumbs photos={photos} alt={alt} i={i} go={go} />}
      <AnimatePresence>{full && <FullScreen photos={photos} alt={alt} i={i} dir={dir} go={go} onClose={() => setFull(false)} />}</AnimatePresence>
    </div>
  );
}

function Stage({
  photos, alt, i, dir, go, className, children, sizes = "(max-width: 820px) 100vw, 820px", fit,
}: {
  photos: (Img | null)[]; alt: string; i: number; dir: number; go: (to: number) => void; className?: string;
  children?: React.ReactNode; sizes?: string; fit?: boolean;
}) {
  const t = useTranslations("gallery");
  const reduce = useReducedMotion();
  const n = photos.length;
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -SWIPE || info.velocity.x < -400) go(i + 1);
    else if (info.offset.x > SWIPE || info.velocity.x > 400) go(i - 1);
  };
  return (
    <div
      className={cn("group relative overflow-hidden bg-surface-2", className)}
      role="region"
      aria-roledescription={t("roledesc")}
      aria-label={t("region", { alt, i: i + 1, n })}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(i + 1);
        if (e.key === "ArrowLeft") go(i - 1);
      }}
    >
      <AnimatePresence initial={false} custom={dir}>
        <m.div
          key={i}
          custom={dir}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          drag={n > 1 ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          onDragEnd={onDragEnd}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -60 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <SmartImage
            img={photos[i]}
            alt={t("image", { alt, i: i + 1 })}
            sizes={sizes}
            className="h-full w-full"
            imgClassName={fit ? "!object-contain" : undefined}
          />
        </m.div>
      </AnimatePresence>
      {children}
      {n > 1 && (
        <>
          <Arrow side="left" onClick={() => go(i - 1)} />
          <Arrow side="right" onClick={() => go(i + 1)} />
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
            {photos.map((_, k) => (
              <button
                key={k}
                type="button"
                aria-label={t("pick", { i: k + 1 })}
                aria-current={k === i}
                onClick={() => go(k)}
                className={cn("h-2 rounded-full shadow transition-all duration-300", k === i ? "w-6 bg-pink" : "w-2 bg-white/70 hover:bg-white")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  const t = useTranslations("gallery");
  const Icon = side === "left" ? IconChevronLeft : IconChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t(side === "left" ? "prev" : "next")}
      className={cn(
        "absolute top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-brand shadow-soft backdrop-blur transition hover:scale-110 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon />
    </button>
  );
}

function Thumbs({ photos, alt, i, go, dark }: { photos: (Img | null)[]; alt: string; i: number; go: (to: number) => void; dark?: boolean }) {
  const t = useTranslations("gallery");
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // scroll the strip only (scrollIntoView would also scroll the page)
    const s = strip.current;
    const el = s?.children[i] as HTMLElement | undefined;
    if (s && el) s.scrollTo({ left: el.offsetLeft - (s.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }, [i]);
  return (
    <div ref={strip} className="no-scrollbar relative flex gap-2 overflow-x-auto px-0.5 py-1">
      {photos.map((p, k) => (
        <button
          key={k}
          type="button"
          onClick={() => go(k)}
          aria-label={t("pick", { i: k + 1 })}
          aria-current={k === i}
          className={cn(
            "relative h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 transition-all duration-300",
            dark ? "ring-offset-black" : "ring-offset-surface",
            k === i ? "ring-pink" : "opacity-60 ring-transparent hover:opacity-100",
          )}
        >
          <SmartImage img={p} alt={t("thumb", { alt, i: k + 1 })} sizes="96px" className="h-full w-full" label=" " />
        </button>
      ))}
    </div>
  );
}

function FullScreen({
  photos, alt, i, dir, go, onClose,
}: { photos: (Img | null)[]; alt: string; i: number; dir: number; go: (to: number) => void; onClose: () => void }) {
  const t = useTranslations("gallery");
  useScrollLock();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopImmediatePropagation(); onClose(); }
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [i, go, onClose]);
  return createPortal(
    <m.div
      role="dialog"
      aria-modal="true"
      aria-label={t("fullDialog", { alt })}
      className="fixed inset-0 z-[120] flex flex-col bg-black/95 p-3 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center justify-between pb-3 text-white">
        <span className="text-sm text-white/70">{i + 1} / {photos.length}</span>
        <button type="button" onClick={onClose} aria-label={t("closeFull")} autoFocus className="grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
          <IconClose />
        </button>
      </div>
      <Stage photos={photos} alt={alt} i={i} dir={dir} go={go} sizes="100vw" fit className="min-h-0 flex-1 rounded-2xl !bg-transparent" />
      {photos.length > 1 && <div className="mx-auto mt-3 max-w-full"><Thumbs photos={photos} alt={alt} i={i} go={go} dark /></div>}
    </m.div>,
    document.body,
  );
}
