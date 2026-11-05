// Browser side of the anti-code-fetching gate: one POST /api/gate per page load (or per 6 h in a tab), shared by
// everything that calls /api (the visit beacon, the status tracker). Not run under automation (navigator.webdriver).
const KEY = "utd_g";
const REFRESH_MS = 6 * 3600e3; // the cookie lasts 12 h

let pending: Promise<boolean> | null = null;

/** Resolves true once the gate cookie is in place (false: automation, or the server refused). */
export function ensureGate(): Promise<boolean> {
  if (pending) return pending;
  if (navigator.webdriver) return (pending = Promise.resolve(false));
  try {
    const at = Number(sessionStorage.getItem(KEY));
    if (at && Date.now() - at < REFRESH_MS) return (pending = Promise.resolve(true));
  } catch {}
  pending = fetch("/api/gate", { method: "POST", credentials: "same-origin" })
    .then((r) => {
      if (r.ok) {
        try {
          sessionStorage.setItem(KEY, String(Date.now()));
        } catch {}
      }
      return r.ok;
    })
    .catch(() => false);
  return pending;
}
