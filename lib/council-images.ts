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
