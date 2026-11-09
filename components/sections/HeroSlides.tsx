"use client";

import { motion, useReducedMotion } from "motion/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { Photo } from "@/lib/content";
import { IconChevronLeft, IconChevronRight } from "@/components/icons/Icon";
import { cn } from "@/lib/utils";

const INTERVAL = 6000;
const SWIPE = 0.18; // share of the frame width a drag must cover to change slide
const FLICK = 0.45; // px per ms: a fast flick changes slide even when short
// Ken Burns: each slide drifts toward a different corner
const ORIGINS = ["20% 30%", "80% 25%", "70% 80%", "25% 75%"];

type Drag = { id: number; x: number; y: number; t: number; lastX: number; lastT: number; axis: "x" | "y" | null };

/**
 * Full-frame hero slider. A track of slides, each exactly 100% of the frame, moved with
 * translate3d(-index * 100%) and no gap, so a slide always fills the rounded frame and nothing peeks in.
 * The track follows the finger / mouse while dragging and snaps to the nearest slide (at most one step per gesture);
 * resizing or rotating re-snaps by itself because the offset is in %. Auto-advance 6 s, paused on hover, focus,
 * touch/drag and under prefers-reduced-motion. ←/→ keys, arrows on the photo (desktop, keyboard-reachable), dots
 * under the frame. Renders the rounded banner frame; `children` (navy overlay + headline) sit between the photos and
 * the controls. No photos -> one navy gradient slide, no controls.
 */
export function HeroSlides({ photos, children }: { photos: Photo[]; children: React.ReactNode }) {
  const t = useTranslations("hero");
  const reduce = useReducedMotion();
  const locale = useLocale();
  const [i, setI] = useState(0);
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dx, setDx] = useState<number | null>(null); // drag offset in px; null = not dragging
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const n = photos.length;
  const paused = hover || focused || dx !== null || !!reduce;

  useEffect(() => {
    if (paused || n < 2) return;
    const id = setTimeout(() => setI((x) => (x + 1) % n), (photos[i]?.seconds ?? INTERVAL / 1000) * 1000);
    return () => clearTimeout(id);
  }, [i, paused, n, photos]);

  const go = (d: number) => setI((x) => (x + d + n) % n);

  const onPointerDown = (e: React.PointerEvent) => {
    if (n < 2 || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, lastX: e.clientX, lastT: e.timeStamp, axis: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      d.axis = Math.abs(mx) > Math.abs(my) ? "x" : "y";
      if (d.axis === "y") {
        drag.current = null; // vertical: let the page scroll
        return;
      }
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    const w = frame.current?.offsetWidth ?? 1;
    // rubber-band past the first / last slide
    const edge = (i === 0 && mx > 0) || (i === n - 1 && mx < 0);
    setDx(Math.max(-w, Math.min(w, edge ? mx * 0.35 : mx)));
    d.lastX = e.clientX;
    d.lastT = e.timeStamp;
  };
  const endDrag = (e: React.PointerEvent, cancelled = false) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || d.axis !== "x") {
      setDx(null);
      return;
    }
    const w = frame.current?.offsetWidth ?? 1;
    const moved = e.clientX - d.x;
    const v = (e.clientX - d.lastX) / Math.max(1, e.timeStamp - d.lastT) || moved / Math.max(1, e.timeStamp - d.t);
    if (!cancelled && (moved < -w * SWIPE || v < -FLICK) && i < n - 1) setI(i + 1);
    else if (!cancelled && (moved > w * SWIPE || v > FLICK) && i > 0) setI(i - 1);
    setDx(null); // snap (transition back on)
  };

  const altOf = (ph: Photo) => (ph.alt ? (locale === "en" && ph.alt.en ? ph.alt.en : ph.alt.th) : ph.caption || t("alt"));
  const p = photos[i];

  return (
    <>
    <section
      aria-label={t("label")}
      className="relative isolate aspect-[4860/2110] overflow-hidden rounded-[20px] bg-gradient-to-br from-brand-deep via-[#0b1f4d] to-brand-mid text-on-brand shadow-soft [clip-path:inset(0_round_20px)]"
    >
    <div
      ref={frame}
      className="group absolute inset-0 outline-none"
      role={n > 1 ? "region" : undefined}
      aria-roledescription={n > 1 ? t("roledesc") : undefined}
      aria-label={n > 1 ? t("region", { i: i + 1, n }) : undefined}
      tabIndex={n > 1 ? 0 : undefined}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocused(false)}
      onKeyDown={(e) => {
        if (n < 2) return;
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      }}
    >
      {n === 0 ? (
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(70%_90%_at_85%_20%,rgb(242_122_168/0.35),transparent_60%),radial-gradient(60%_80%_at_70%_100%,rgb(29_59_139/0.9),transparent_70%)]" />
      ) : (
        <div
          className={cn("absolute inset-0 flex touch-pan-y select-none will-change-transform", n > 1 && "cursor-grab active:cursor-grabbing")}
          style={{
            transform: `translate3d(calc(${-i * 100}% + ${dx ?? 0}px), 0, 0)`,
            transition: dx !== null ? "none" : `transform ${reduce ? 0 : 520}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e)}
          onPointerCancel={(e) => endDrag(e, true)}
        >
          {photos.map((ph, k) => (
            <div
              key={ph.id}
              aria-hidden={k !== i}
              className="relative h-full w-full shrink-0 grow-0 basis-full overflow-hidden"
              style={{ backgroundImage: ph.blur ? `url(${ph.blur})` : undefined, backgroundSize: "cover", backgroundPosition: ph.focal ?? "50% 50%" }}
            >
              {/* fills its slide, cropped around the focal point; Ken Burns drift on the current slide only */}
              <picture className="contents">
                {ph.avifSet && <source type="image/avif" srcSet={ph.avifSet} sizes="(max-width: 1320px) 100vw, 1320px" />}
                <motion.img
                  src={ph.src}
                  srcSet={ph.srcSet}
                  sizes="(max-width: 1320px) 100vw, 1320px"
                  alt={k === i ? altOf(ph) : ""}
                  width={ph.w}
                  height={ph.h}
                  draggable={false}
                  fetchPriority={k === 0 ? "high" : "low"}
                  loading={k === 0 ? "eager" : "lazy"}
                  className="no-select pointer-events-none absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: ph.focal ?? "50% 50%", transformOrigin: ORIGINS[k % ORIGINS.length] }}
                  initial={false}
                  animate={{ scale: k === i && !reduce && !ph.plain ? 1.08 : 1 }}
                  transition={{ scale: { duration: k === i ? (INTERVAL + 1200) / 1000 : 0.4, ease: "linear" } }}
                />
              </picture>
            </div>
          ))}
        </div>
      )}

      {!p?.plain && children}

      {p?.credit && !p.plain && (
        <span className="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-black/35 px-2.5 py-0.5 text-[0.68rem] text-white/85 backdrop-blur-sm md:right-4 md:top-4">
          {t(`credit.${p.credit}`)}
        </span>
      )}

      {n > 1 &&
        (["left", "right"] as const).map((side) => {
          const Icon = side === "left" ? IconChevronLeft : IconChevronRight;
          const label = t(side === "left" ? "prev" : "next");
          return (
            <button
              key={side}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => go(side === "left" ? -1 : 1)}
              className={cn(
                // on the photo, vertically centred; desktop only (phones: swipe + dots); visible on hover / keyboard focus
                "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white opacity-0 shadow-lg backdrop-blur-sm transition duration-300 hover:bg-black/60 focus-visible:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 md:grid",
                side === "left" ? "left-4" : "right-4",
              )}
            >
              <Icon width={20} height={20} />
            </button>
          );
        })}
    </div>
    </section>
    {/* under the frame (nothing is drawn over banner artwork): slide dots + credit; fixed height = no layout shift */}
    <div className="mt-2 flex h-5 items-center justify-between gap-3">
      {n > 1 ? (
        <div className="flex" role="group" aria-label={t("pick")}>
          {photos.map((ph, k) => (
            <button
              key={ph.id}
              type="button"
              aria-label={t("slide", { n: k + 1 })}
              aria-current={k === i}
              onClick={() => setI(k)}
              className="-my-0.5 grid h-6 min-w-6 place-items-center"
            >
              <span className={cn("block h-2 rounded-full transition-all duration-500", k === i ? "w-8 bg-pink shadow-glow" : "w-2 bg-brand/25 hover:bg-brand/50")} />
            </button>
          ))}
        </div>
      ) : <span />}
      <p className="text-right text-[0.7rem] leading-4 text-muted" aria-live="off">{p?.plain && p.credit ? t(`credit.${p.credit}`) : ""}</p>
    </div>
    </>
  );
}
