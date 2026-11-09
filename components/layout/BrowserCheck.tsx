"use client";

import { useEffect } from "react";
import { DECOY_TEXT } from "@/lib/decoy-text";
import { afterLoad, gateMode } from "@/lib/gate-client";

/**
 * Runs in the browser on every page: prints the notice once, gets the gate cookie (lib/gate-client.ts) and starts the
 * browser-side blocking in the mode the server answers (lib/protect-client.ts, its own chunk).
 */
export function BrowserCheck() {
  // after load + idle: nothing here may delay the first render (Lighthouse TBT)
  useEffect(() =>
    afterLoad(() => {
      console.log(DECOY_TEXT);
      void gateMode().then((mode) => {
        if (mode === "off") return; // admins, the owner's dev cookie, PROTECTION_MODE=off
        void import("@/lib/protect-client").then((p) => p.startProtection(mode));
      });
    }), []);
  return null;
}
