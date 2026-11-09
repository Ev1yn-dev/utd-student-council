// Browser-side part of the anti-code-fetching protection (started by components/layout/BrowserCheck.tsx after load,
// in requestIdleCallback, with the mode /api/gate answers — see lib/browser-gate.ts for the server side).
//
// "relaxed" and "strict": no text selection / copy / cut / drag (the clipboard gets the message instead), no
//   context menu, no DevTools / view-source / save / print shortcuts, and printing shows only the message.
//   Always allowed: form fields (typing, selecting, pasting), links (right-click / long-press "open link"), and anything
//   marked [data-allow-copy] (the site's own copy buttons).
// "strict" also: DevTools detection (window-size difference + a console getter). Open -> the page is replaced by a
//   full-screen message; closed again -> reload. Never on phones / tablets (touch-only), never when the zoom changes,
//   never for a side panel that was already there at load (Edge sidebar), and a horizontal-only difference in Edge
//   needs the console signal too. No debugger loops, no alerts, no console clearing.
import { DECOY_TEXT } from "@/lib/decoy-text";
import type { ClientMode } from "@/lib/gate-client";

const FREE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-allow-copy]';
const LINK = "a[href]";
const WALL_ID = "utd-protect-wall";

const inside = (t: EventTarget | null, sel: string) => t instanceof Element && !!t.closest(sel);
// sign-in / back office (also reached by in-app navigation from a public page): never blocked
const BACK_OFFICE = /^\/(?:th|en)\/(?:dashboard|admin|pending-access|login)(?:\/|$)/;
const active = () => !BACK_OFFICE.test(location.pathname);

function blockCopying() {
  const sync = () => document.documentElement.classList.toggle("protect", active());
  sync();
  window.setInterval(sync, 1000);
  const stop = (e: Event) => {
    if (active() && !inside(e.target, FREE)) e.preventDefault();
  };
  const onCopy = (e: ClipboardEvent) => {
    if (!active() || inside(e.target, FREE)) return;
    e.preventDefault();
    e.clipboardData?.setData("text/plain", DECOY_TEXT);
  };
  document.addEventListener("copy", onCopy, true);
  document.addEventListener("cut", onCopy, true);
  document.addEventListener("selectstart", stop, true);
  document.addEventListener("dragstart", (e) => {
    if (active() && !inside(e.target, `${FREE}, ${LINK}`)) e.preventDefault();
  }, true);
  document.addEventListener("contextmenu", (e) => {
    if (active() && !inside(e.target, `${FREE}, ${LINK}`)) e.preventDefault();
  }, true);
}

/** F12, Ctrl+Shift+I/J/C/K, Ctrl+U, Ctrl+S, Ctrl+P and the Mac Cmd(+Option/Shift) forms. Find, reload, zoom, Tab... stay. */
function blockShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (!active()) return;
    // e.code: the physical key (Option on a Mac changes e.key to another character)
    const k = e.code.startsWith("Key") ? e.code.slice(3).toLowerCase() : e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    const devtools = (mod && (e.shiftKey || e.altKey) && ["i", "j", "c", "k"].includes(k)) || k === "f12";
    const page = mod && !e.shiftKey && !e.altKey && ["u", "s", "p"].includes(k);
    const viewSourceMac = e.metaKey && e.altKey && k === "u";
    if (devtools || page || viewSourceMac) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

function wall(show: boolean) {
  const html = document.documentElement;
  let el = document.getElementById(WALL_ID);
  if (!show) {
    el?.remove();
    html.classList.remove("protect-wall");
    return;
  }
  if (el) return;
  el = document.createElement("div");
  el.id = WALL_ID;
  el.setAttribute("role", "alert");
  el.lang = "th";
  el.textContent = DECOY_TEXT;
  document.body.appendChild(el);
  html.classList.add("protect-wall");
}

/** Phones and tablets: no DevTools to detect, and their browser UI changes the window size all the time. */
const touchOnly = () =>
  (matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches) || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

function detectDevtools() {
  if (touchOnly()) return;
  const edge = /\bEdg\//.test(navigator.userAgent);
  const dpr = window.devicePixelRatio;
  // whatever is already beside / below the page at load (Edge sidebar, a bookmarks bar) is the baseline
  const base = { w: window.outerWidth - window.innerWidth, h: window.outerHeight - window.innerHeight };
  const GAP = 160;
  let consoleHit = false;
  const probe = new Image();
  Object.defineProperty(probe, "id", {
    get() {
      consoleHit = true; // read by the console only while it is open and showing messages
      return "";
    },
  });
  let open = false;
  let hits = 0;
  let misses = 0;
  const tick = () => {
    if (!active()) return;
    consoleHit = false;
    console.debug(probe);
    // a zoom change resizes everything: skip until the zoom is back where it was
    const zoomed = Math.abs(window.devicePixelRatio - dpr) > 0.01;
    const dw = window.outerWidth - window.innerWidth - base.w;
    const dh = window.outerHeight - window.innerHeight - base.h;
    const minimised = window.outerWidth === 0 || window.outerHeight === 0;
    const sized = !zoomed && !minimised && (dh > GAP || (dw > GAP && (!edge || consoleHit)));
    queueMicrotask(() => {
      const now = sized || consoleHit;
      if (now) {
        misses = 0;
        if (++hits >= 2 && !open) {
          open = true;
          wall(true);
        }
      } else {
        hits = 0;
        if (open && ++misses >= 2) location.reload();
      }
    });
  };
  window.setInterval(tick, 1000);
  window.addEventListener("resize", tick);
}

let started = false;
export function startProtection(mode: ClientMode) {
  if (started || mode === "off") return;
  started = true;
  blockCopying();
  blockShortcuts();
  if (mode === "strict") detectDevtools();
}
