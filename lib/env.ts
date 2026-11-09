// Env access in one place. Only the Supabase URL / anon key are NEXT_PUBLIC_ (public by design).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);

const list = (v: string | undefined) =>
  (v ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export const allowedDomain = () => (process.env.ALLOWED_EMAIL_DOMAIN ?? "utd.ac.th").trim().toLowerCase().replace(/^@/, "");
export const adminEmails = () => list(process.env.ADMIN_EMAILS);

/** Server-side domain check. Never trust Google's `hd` hint alone. */
export function isAllowedEmail(email: string | null | undefined) {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e.endsWith(`@${allowedDomain()}`) && e.split("@").length === 2;
}

/** Emails are compared trimmed + lower-case everywhere. */
export const normalizeEmail = (e: string | null | undefined) => (e ?? "").trim().toLowerCase();

export type Access = "admin" | "council" | "teacher" | "pending" | "denied";
/** A row of public.allowed_users for this address (null = not in the table). */
export type AllowedRow = { role: string; active: boolean } | null;

/**
 * The one sign-in / role decision (OAuth callback and every request). Order:
 *   1. Google did not verify the address, or it is malformed  -> denied
 *   2. listed in ADMIN_EMAILS                                   -> admin
 *   3. active row in allowed_users                              -> that role (council / teacher)
 *   4. other address on ALLOWED_EMAIL_DOMAIN                    -> pending (signed in, no back office: /pending-access)
 *   5. anything else                                            -> denied
 */
/** Google's own "email verified" claim (Supabase keeps it in user_metadata and in the identity data). */
export function googleVerified(u: { user_metadata?: { email_verified?: unknown }; identities?: { provider: string; identity_data?: { email_verified?: unknown } }[] }) {
  return u.user_metadata?.email_verified === true || !!u.identities?.some((i) => i.provider === "google" && i.identity_data?.email_verified === true);
}

/** Whether a verified Supabase user is an administrator (ADMIN_EMAILS; same rule as decideAccess). */
export const isAdminUser = (u: { email?: string; email_confirmed_at?: string | null } & Parameters<typeof googleVerified>[0]) =>
  !!u.email_confirmed_at && decideAccess(u.email, googleVerified(u), null) === "admin";

export function decideAccess(email: string | null | undefined, googleVerified: boolean, allowed: AllowedRow): Access {
  const e = normalizeEmail(email);
  if (!googleVerified || e.split("@").length !== 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return "denied";
  if (adminEmails().includes(e)) return "admin";
  if (allowed?.active && (allowed.role === "council" || allowed.role === "teacher")) return allowed.role;
  if (isAllowedEmail(e)) return "pending";
  return "denied";
}

/** Comma-separated list from COUNCIL_EMAILS (seed input for allowed_users; ":shared" marks a shared account). */
export const councilEmails = () =>
  list(process.env.COUNCIL_EMAILS).map((x) => ({ email: x.replace(/:shared$/, ""), shared: x.endsWith(":shared") }));
