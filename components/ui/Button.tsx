"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "outline-dark" | "ghost";

const BASE =
  "relative inline-flex items-center justify-center overflow-hidden rounded-full px-8 py-3.5 font-display text-lg font-semibold transition-shadow duration-300 select-none";
const VARIANTS: Record<Variant, string> = {
  // 18px / 600 weight counts as "large text" for WCAG AA on pink-500 (3.6:1).
  primary: "bg-pink text-white hover:shadow-glow",
  outline: "border-2 border-on-brand text-on-brand hover:bg-white/10",
  "outline-dark": "border-2 border-brand text-ink hover:bg-brand hover:text-on-brand",
  ghost: "text-ink hover:text-pink-ink",
};

type Props = {
  href?: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
};

/** Button with magnetic hover (pointer devices) and ripple on press. */
export function Button({ href, variant = "primary", className, children, type = "button", disabled, onClick }: Props) {
  // magnetic pull: a CSS transform with a springy transition (no animation library on the page's first JS)
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [pull, setPull] = useState<[number, number]>([0, 0]);
  const ref = useRef<HTMLSpanElement>(null);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !ref.current || reduce()) return;
    const r = ref.current.getBoundingClientRect();
    setPull([(e.clientX - (r.left + r.width / 2)) * 0.18, (e.clientY - (r.top + r.height / 2)) * 0.28]);
  };
  const reset = () => setPull([0, 0]);
  const onDown = (e: React.PointerEvent) => {
    if (!ref.current || reduce()) return;
    const r = ref.current.getBoundingClientRect();
    const id = Date.now() + Math.random();
    setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
    setTimeout(() => setRipples((rs) => rs.filter((q) => q.id !== id)), 600);
  };

  const cls = cn(BASE, VARIANTS[variant], disabled && "opacity-60 pointer-events-none", className);
  const inner = (
    <>
      <span className="relative z-10">{children}</span>
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute h-16 w-16 rounded-full bg-white/50"
          style={{ left: r.x - 32, top: r.y - 32, animation: "ripple 600ms var(--ease-out) forwards" }}
        />
      ))}
    </>
  );

  return (
    <span
      ref={ref}
      style={{ transform: `translate3d(${pull[0]}px, ${pull[1]}px, 0)`, transition: "transform 450ms cubic-bezier(0.34, 1.56, 0.64, 1)" }}
      className="inline-block"
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {href ? (
        <Link href={href} className={cls} onPointerDown={onDown}>{inner}</Link>
      ) : (
        <button type={type} className={cls} disabled={disabled} onClick={onClick} onPointerDown={onDown}>{inner}</button>
      )}
    </span>
  );
}
