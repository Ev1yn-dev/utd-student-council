// One icon component for the whole site. Glyphs: Phosphor Icons (MIT, duotone weight); brand marks: Simple Icons (CC0).
// The duotone fill layer is coloured pink in globals.css (.ico), the outline uses currentColor — so icons read
// navy/white + pink everywhere. The glyph markup is pre-rendered by scripts/gen-icons.mjs (components/icons/glyphs.ts):
// only the icons and weights in use reach the browser, not the whole icon library. No React context: renders in server
// and client components alike.
import { siFacebook, siInstagram, siTiktok } from "simple-icons";
import { GLYPHS } from "@/components/icons/glyphs";
import { cn } from "@/lib/utils";

const BRANDS = { facebook: siFacebook, instagram: siInstagram, tiktok: siTiktok };

export type IconName = keyof typeof GLYPHS | keyof typeof BRANDS;

export type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
  /** "fill" for solid glyphs on small badges; default duotone */
  weight?: "duotone" | "fill" | "bold";
  label?: string;
};

export function Icon({ name, size = 20, className, weight = "duotone", label }: IconProps) {
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const };
  if (name in BRANDS) {
    const b = BRANDS[name as keyof typeof BRANDS];
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={cn("ico shrink-0", className)} {...a11y}>
        <path d={b.path} />
      </svg>
    );
  }
  const g: { duotone: string; bold?: string; fill?: string } = GLYPHS[name as keyof typeof GLYPHS];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="currentColor"
      viewBox="0 0 256 256"
      className={cn("ico shrink-0", className)}
      {...a11y}
      dangerouslySetInnerHTML={{ __html: g[weight] ?? g.duotone }}
    />
  );
}

// Named aliases keep call sites short and typed: <IconSearch width={16} /> === <Icon name="search" size={16} />.
type Legacy = { width?: number; height?: number; className?: string; strokeWidth?: number };
const alias = (name: IconName, weight?: IconProps["weight"]) => {
  const C = ({ width, className }: Legacy) => <Icon name={name} size={width} className={className} weight={weight} />;
  C.displayName = `Icon(${name})`;
  return C;
};
export const IconFacebook = alias("facebook");
export const IconInstagram = alias("instagram");
export const IconTiktok = alias("tiktok");
export const IconSearch = alias("search");
export const IconCalendar = alias("calendar");
export const IconLink = alias("link");
export const IconExternal = alias("external");
export const IconClose = alias("close", "bold");
export const IconChevronLeft = alias("chevronLeft", "bold");
export const IconChevronRight = alias("chevronRight", "bold");
export const IconChevronDown = alias("chevronDown", "bold");
export const IconArrowUp = alias("arrowUp", "bold");
export const IconArrowLeft = alias("arrowLeft", "bold");
export const IconCrown = alias("crown", "fill");
export const IconMedal = alias("medal", "fill");
export const IconStar = alias("star");
export const IconPin = alias("pin");
export const IconMegaphone = alias("megaphone");
export const IconImages = alias("images");
export const IconImage = alias("image");
export const IconFlag = alias("flag");
export const IconUsers = alias("users");
export const IconTeacher = alias("teacher");
export const IconInfo = alias("info");
export const IconExpand = alias("expand");
export const IconReset = alias("reset");
export const IconUser = alias("user");
