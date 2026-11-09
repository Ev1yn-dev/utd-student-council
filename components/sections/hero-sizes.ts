/**
 * The hero frame takes the page width minus the 16px gutters, up to 1288px (shared by the slider and the preload).
 * Capped at 1280px so a desktop picks the 1280w file (0.6% upscale) instead of 1920w.
 */
export const HERO_SIZES = "(max-width: 1312px) calc(100vw - 32px), 1280px";
