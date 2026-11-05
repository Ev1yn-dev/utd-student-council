// Fixed, non-translatable site settings. Every visible text lives in messages/<locale>.json.

/**
 * The site's one public address (utdsc.com). Used for metadataBase, canonical + hreflang, og:url, sitemap, robots,
 * JSON-LD and the Google sign-in redirect — never the request's Host. Other hosts (www, *.vercel.app) are handled in
 * proxy.ts (www -> 301 here; sign-in / back office -> 308 here; public pages noindex).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://utdsc.com").replace(/\/+$/, "");
export const SITE_HOST = new URL(SITE_URL).host;
export const SITE = {
  founded: 2452,
} as const;


/** Voice categories: stored value (Thai, kept for existing rows) -> message key under voice.categories. */
export const VOICE_CATEGORIES = {
  การเรียน: "learning",
  กิจกรรม: "activities",
  สิ่งแวดล้อม: "environment",
  สวัสดิการ: "welfare",
  อื่นๆ: "other",
} as const;
export type VoiceCategory = keyof typeof VOICE_CATEGORIES;
export const VOICE_CATEGORY_VALUES = Object.keys(VOICE_CATEGORIES) as [VoiceCategory, ...VoiceCategory[]];
