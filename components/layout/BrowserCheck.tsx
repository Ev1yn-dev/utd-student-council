"use client";

import { useEffect } from "react";
import { DECOY_TEXT } from "@/lib/decoy-text";
import { ensureGate } from "@/lib/gate-client";

/** Runs in the browser on every page: prints the notice once and gets the gate cookie (lib/gate-client.ts). */
export function BrowserCheck() {
  useEffect(() => {
    console.log(DECOY_TEXT);
    void ensureGate();
  }, []);
  return null;
}
