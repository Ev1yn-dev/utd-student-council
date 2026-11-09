"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { afterLoad, ensureGate } from "@/lib/gate-client";

/** Counts a page view with one small beacon (no cookies, no third party). The referrer goes with the first view only. */
export function VisitBeacon() {
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (navigator.webdriver || typeof navigator.sendBeacon !== "function") return;
    const body: { p: string; r?: string } = { p: path };
    if (first.current) {
      body.r = document.referrer;
      first.current = false;
    }
    // /api needs the gate cookie: send once it is in place, after load + idle
    return afterLoad(() => {
      void ensureGate().then((ok) => {
        if (!ok) return;
        try {
          navigator.sendBeacon("/api/track", JSON.stringify(body));
        } catch {}
      });
    });
  }, [path]);
  return null;
}
