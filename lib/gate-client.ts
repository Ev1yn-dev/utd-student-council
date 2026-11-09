// Browser side of the anti-code-fetching gate: one POST /api/gate per page load (or per 6 h in a tab), shared by
// everything that calls /api (the visit beacon, the status tracker) and by the browser-side blocking
// (components/layout/Protect.tsx), which follows the mode the server answers. Not run under automation (navigator.webdriver).
const KEY = "utd_g";
const REFRESH_MS = 6 * 3600e3; // the cookie lasts 12 h

export type ClientMode = "strict" | "relaxed" | "off";
type Gate = { ok: boolean; mode: ClientMode };

let pending: Promise<Gate> | null = null;

/** utd_np = "this browser may be exempt" (admin / owner): a change of it means asking the server again. */
const hint = () => (/(?:^|;\s*)utd_np=1(?:;|$)/.test(document.cookie) ? "1" : "0");
const isMode = (v: unknown): v is ClientMode => v === "strict" || v === "relaxed" || v === "off";

function gate(): Promise<Gate> {
  if (pending) return pending;
  if (navigator.webdriver) return (pending = Promise.resolve({ ok: false, mode: "strict" }));
  try {
    const [at, mode, h] = (sessionStorage.getItem(KEY) ?? "").split("|");
    if (Number(at) && Date.now() - Number(at) < REFRESH_MS && isMode(mode) && h === hint()) return (pending = Promise.resolve({ ok: true, mode }));
  } catch {}
  pending = fetch("/api/gate", { method: "POST", credentials: "same-origin" })
    .then(async (r) => {
      if (!r.ok) return { ok: false, mode: "strict" as const };
      const body: unknown = await r.json().catch(() => null);
      const raw = body && typeof body === "object" ? (body as { mode?: unknown }).mode : undefined;
      const mode: ClientMode = isMode(raw) ? raw : "strict";
      try {
        sessionStorage.setItem(KEY, `${Date.now()}|${mode}|${hint()}`);
      } catch {}
      return { ok: true, mode };
    })
    .catch(() => ({ ok: false, mode: "strict" as const }));
  return pending;
}

/** Resolves true once the gate cookie is in place (false: automation, or the server refused). */
export const ensureGate = (): Promise<boolean> => gate().then((g) => g.ok);

/** The browser-side blocking that applies to this visitor ("strict" when the server could not be asked). */
export const gateMode = (): Promise<ClientMode> => gate().then((g) => g.mode);

/**
 * Runs `fn` once the page has loaded and the main thread is idle (requestIdleCallback, at most 3 s later), so the
 * notice, the gate cookie and the visit beacon never compete with the first render. Returns a cancel function.
 */
export function afterLoad(fn: () => void): () => void {
  let idle = 0;
  let timer = 0;
  const run = () => {
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(fn, { timeout: 3000 });
    else timer = window.setTimeout(fn, 1);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
  return () => {
    window.removeEventListener("load", run);
    if (idle) window.cancelIdleCallback(idle);
    if (timer) window.clearTimeout(timer);
  };
}
