import type { MetadataRoute } from "next";

/**
 * Web app manifest: name + council crest icons (scripts/make-icons.mjs): favicon.ico 16/32/48, icon.png 192,
 * apple-icon.png 180, favicon-192 / favicon-512 for install. All served outside the proxy (no gate) — see proxy.ts.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "คณะกรรมการสภานักเรียน โรงเรียนอุตรดิตถ์",
    short_name: "สภานักเรียน UTD",
    start_url: "/th",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0b1f4d",
    icons: [
      { src: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/brand/favicon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/favicon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
