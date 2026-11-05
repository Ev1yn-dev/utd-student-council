"use client";

import { useEffect } from "react";
import { DECOY_TEXT } from "@/lib/decoy-text";

const KEY = "utd_g";
const REFRESH_MS = 6 * 3600e3; // the cookie lasts 12 h; ask again after 6 h

/**
 * Runs in the browser on every page: prints the notice once, and (JS on, not driven by automation) asks the server
 * for the short signed cookie that files and /api need (app/api/gate/route.ts, lib/browser-gate.ts).
 */
export function BrowserCheck() {
  useEffect(() => {
    console.log(DECOY_TEXT);
    if (navigator.webdriver) return;
    try {
      const at = Number(sessionStorage.getItem(KEY));
      if (at && Date.now() - at < REFRESH_MS) return;
    } catch {}
    fetch("/api/gate", { method: "POST", credentials: "same-origin" })
      .then((r) => {
        if (r.ok) sessionStorage.setItem(KEY, String(Date.now()));
      })
      .catch(() => {});
  }, []);
  return null;
}
