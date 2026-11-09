"use client";

import { useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { IconArrowUp } from "@/components/icons/Icon";

const R = 22;

/** Appears after scrolling down; the ring around it fills with the page scroll progress. */
export function ScrollTop() {
  const t = useTranslations("common");
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  // one passive scroll listener, read once per frame (no animation library on the page's first JS)
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setShow(window.scrollY > 500);
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    const on = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      cancelAnimationFrame(frame);
    };
  }, []);
  const C = 2 * Math.PI * R;
  return (
        <button
          type="button"
          aria-label={t("scrollTop")}
          aria-hidden={!show}
          tabIndex={show ? 0 : -1}
          onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
          className={`fixed bottom-5 right-4 z-40 grid h-[52px] w-[52px] place-items-center rounded-full bg-brand-deep text-on-brand shadow-[0_10px_30px_-8px_rgb(5_13_36/0.6)] transition-[opacity,transform] duration-300 sm:bottom-7 sm:right-7 ${show ? "opacity-100 hover:-translate-y-[3px]" : "pointer-events-none translate-y-5 scale-[0.8] opacity-0"}`}
        >
          <svg aria-hidden width="52" height="52" viewBox="0 0 52 52" className="absolute inset-0 -rotate-90">
            <circle cx="26" cy="26" r={R} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="3" />
            <circle cx="26" cy="26" r={R} fill="none" stroke="var(--c-pink)" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
          </svg>
          <IconArrowUp width={20} height={20} className="relative" />
        </button>
  );
}
