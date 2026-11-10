"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Img } from "@/lib/content";
import { Illustration } from "@/components/icons/Illustration";
import { cn } from "@/lib/utils";

/**
 * Image with a loading skeleton: the stored tiny blur (if any) shows instantly, a shimmer runs until the real
 * file decodes, then it fades in. `img = null` (no approved photo yet) renders a designed [placeholder] tile.
 * Sizing comes from the wrapper (`className`), the image always covers it.
 */
export function SmartImage({
  img,
  alt,
  sizes = "100vw",
  className,
  imgClassName,
  kind = "photo",
  priority,
  label,
  style,
}: {
  img: Img | null;
  alt: string;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  kind?: "photo" | "portrait";
  priority?: boolean;
  label?: string;
  /** extra wrapper style, e.g. an aspect-ratio taken from the image */
  style?: React.CSSProperties;
}) {
  const t = useTranslations("common");
  const [loaded, setLoaded] = useState(false);

  if (!img) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "relative grid place-items-center overflow-hidden",
          kind === "portrait"
            ? "bg-gradient-to-b from-sky to-sky-strong text-brand-mid/45"
            : "bg-[radial-gradient(120%_90%_at_10%_0%,var(--c-sky-strong),transparent_60%),radial-gradient(90%_90%_at_100%_100%,var(--c-pink-soft),transparent_60%)] bg-surface-2 text-brand-mid/40",
          className,
        )}
      >
        <div className="flex flex-col items-center gap-1.5">
          <Illustration name={kind === "portrait" ? "portrait" : "photo"} className={kind === "portrait" ? "h-24 w-auto" : "h-14 w-auto"} />
          <span className="text-xs font-medium text-muted">{label ?? t(kind === "portrait" ? "portrait" : "photo")}</span>
        </div>
      </div>
    );
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- variants are pre-generated webp/avif in Supabase storage
    <img
        src={img.src[960]}
        srcSet={img.src[480] === img.src[1920] ? `${img.src[480]} ${img.w}w` : img.src[960] === img.src[1920] ? `${img.src[480]} 480w, ${img.src[960]} ${img.w}w` : `${img.src[480]} 480w, ${img.src[960]} 960w, ${img.src[1920]} 1920w`}
        sizes={sizes}
        alt={alt}
        width={img.w}
        height={img.h}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        draggable={false}
        ref={(el) => { if (el?.complete && el.naturalWidth) setLoaded(true); }}
        onLoad={() => setLoaded(true)}
        className={cn(
          "no-select absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 ease-out",
          loaded ? "opacity-100" : "opacity-0",
          imgClassName,
        )}
      />
  );

  return (
    <div
      className={cn("relative overflow-hidden", !loaded && !img.blur && "skeleton", className)}
      style={img.blur ? { ...style, backgroundImage: `url(${img.blur})`, backgroundSize: "cover", backgroundPosition: "center" } : style}
    >
      {!loaded && img.blur && <div aria-hidden className="skeleton absolute inset-0 opacity-40" />}
      {/* AVIF first when the image has it (council portraits); WebP is the fallback. `contents` keeps the img
          positioned against this wrapper */}
      {img.avif ? (
        <picture className="contents">
          <source type="image/avif" srcSet={img.avif} sizes={sizes} />
          {image}
        </picture>
      ) : (
        image
      )}
    </div>
  );
}
