// Theme illustrations drawn for this site (public/illustrations, licences in LICENSES.md). Decorative unless `alt`.
import { cn } from "@/lib/utils";

export type IllustrationName = "empty" | "404" | "pending" | "login" | "portrait" | "photo" | "decor-mandapa" | "decor-kaefarang";

/** Intrinsic size (the SVG viewBox): width/height attributes reserve the box before the file arrives (no layout shift). */
const SIZE: Record<IllustrationName, [number, number]> = {
  empty: [240, 180], "404": [320, 200], pending: [200, 160], login: [200, 140], portrait: [120, 160], photo: [120, 80],
  "decor-mandapa": [240, 220], "decor-kaefarang": [200, 200],
};

export function Illustration({ name, className, alt = "" }: { name: IllustrationName; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed
  return <img src={`/illustrations/${name}.svg`} alt={alt} aria-hidden={alt ? undefined : true} width={SIZE[name][0]} height={SIZE[name][1]} loading="lazy" decoding="async" draggable={false} className={cn("no-select", className)} />;
}
