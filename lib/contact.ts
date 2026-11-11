// The council's official public channels — the ONE place to change them (header links, phone dock).
// No e-mail here: the council's addresses are back-office sign-in accounts, not public contacts.
// Links only: nothing is fetched from Facebook / Instagram / TikTok.
// official: listed as the council's own page in structured data (schema.org sameAs).
// Instagram @utd_stdcc confirmed by the council (2026-11-12; @utd_scc was wrong); also linked from the data note under the tab bar.

export const CHANNELS = [
  { key: "instagram", label: "@utd_stdcc", href: "https://www.instagram.com/utd_stdcc/", official: true },
  { key: "facebook", label: "สภานักเรียนโรงเรียนอุตรดิตถ์", href: "https://www.facebook.com/share/19oUgcDyny/", official: true },
  { key: "tiktok", label: "@utd.sc", href: "https://www.tiktok.com/@utd.sc", official: true },
] as const;
export type Channel = (typeof CHANNELS)[number];

