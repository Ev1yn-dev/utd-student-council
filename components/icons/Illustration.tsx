// Theme illustrations drawn for this site (public/illustrations, licences in LICENSES.md). Decorative unless `alt`.
import { cn } from "@/lib/utils";

export type IllustrationName = "empty" | "404" | "pending" | "login" | "portrait" | "photo" | "decor-mandapa" | "decor-kaefarang";

export function Illustration({ name, className, alt = "" }: { name: IllustrationName; className?: string; alt?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed
  return <img src={`/illustrations/${name}.svg`} alt={alt} aria-hidden={alt ? undefined : true} loading="lazy" decoding="async" draggable={false} className={cn("no-select", className)} />;
}
