// The council's official public channels — the ONE place to change them (header links, phone dock).
// No e-mail here: the council's addresses are back-office sign-in accounts, not public contacts.
// Links only: nothing is fetched from Facebook / Instagram / TikTok.
// Instagram "utd_scc" is still waiting for confirmation against "utd_stdcc" — change it here only.
// official: listed as the council's own page in structured data (schema.org sameAs). Instagram stays false until confirmed.

export const CHANNELS = [
  { key: "instagram", label: "@utd_scc", href: "https://www.instagram.com/utd_scc/", official: false },
  { key: "facebook", label: "สภานักเรียนโรงเรียนอุตรดิตถ์", href: "https://www.facebook.com/share/19oUgcDyny/", official: true },
  { key: "tiktok", label: "@utd.sc", href: "https://www.tiktok.com/@utd.sc", official: true },
] as const;
export type Channel = (typeof CHANNELS)[number];

