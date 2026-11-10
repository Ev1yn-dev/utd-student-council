import type { Img } from "@/lib/content";
import type { CouncilMember } from "@/lib/council-members";

// Roster image sizes (no data import: the client bundle gets the loader without the roster JSON).

/** full introduction card, 720×938 */
export const CARD_SIZE = { w: 720, h: 938 } as const;

/**
 * next/image loader for the roster files. The pre-sized copies (<name>-<w>.webp next to each file) are made once with
 * sharp; the source file is the largest size. Next's optimizer is not used: it fetches the source through proxy.ts,
 * where the gate refuses its internal request.
 */
const SIZES: Record<string, { widths: number[]; full: number }> = {
  "/images/council/avatars/": { widths: [128, 256], full: 400 },
  "/images/council/cards/": { widths: [480], full: CARD_SIZE.w },
};
export function councilImageLoader({ src, width }: { src: string; width: number }) {
  const set = Object.entries(SIZES).find(([dir]) => src.startsWith(dir))?.[1];
  const w = set?.widths.find((x) => x >= width);
  return set && w && w < set.full ? src.replace(/\.webp$/,`-${w}.webp`) : src;
}

/**
 * Roster photo for the portrait frame: the introduction card (plus its 480w copy); without one, the square avatar.
 * The popup shows the card whole.
 */
export function rosterPhoto(p: Pick<CouncilMember, "id" | "card" | "avatar">, card: { w: number; h: number } = CARD_SIZE): Img {
  return p.card
    ? { id: `council-${p.id}`, w: card.w, h: card.h, blur: null, src: { 480: p.card.replace(/\.webp$/, "-480.webp"), 960: p.card, 1920: p.card } }
    : { id: `council-${p.id}`, w: 400, h: 400, blur: null, src: { 480: p.avatar.replace(/\.webp$/, "-256.webp"), 960: p.avatar, 1920: p.avatar } };
}
