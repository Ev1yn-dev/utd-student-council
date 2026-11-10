import { isRole, type AdminRole } from "./admin/permissions.ts"; // relative + extension: also loaded by plain Node (scripts)

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

export type Access = AdminRole | "pending" | "denied";
/** This address's row in public.admin_users (null = not in the table). */
export type AdminRow = { role: string; disabled: boolean } | null;

/** Google's own "email verified" claim (Supabase keeps it in user_metadata and in the identity data). */
export function googleVerified(u: { user_metadata?: { email_verified?: unknown }; identities?: { provider: string; identity_data?: { email_verified?: unknown } }[] }) {
  return u.user_metadata?.email_verified === true || !!u.identities?.some((i) => i.provider === "google" && i.identity_data?.email_verified === true);
}

/**
 * The one sign-in / role decision (OAuth callback and every request). Order:
 *   1. Google did not verify the address, or it is malformed  -> denied
 *   2. row in admin_users: disabled                             -> denied
 *                          otherwise                            -> its role (owner / admin / editor / moderator / viewer)
 *   3. no row, listed in ADMIN_EMAILS                           -> owner (first sign-in creates the row: lib/auth.ts)
 *   4. other address on ALLOWED_EMAIL_DOMAIN                    -> pending (signed in, no back office: /pending-access)
 *   5. anything else                                            -> denied
 * Once an address has a row, the row decides (ADMIN_EMAILS only bootstraps), so the users page can demote or disable
 * anyone, within the last-owner rule (lib/admin/permissions.ts).
 */
export function decideAccess(email: string | null | undefined, googleVerified: boolean, row: AdminRow): Access {
  const e = normalizeEmail(email);
  if (!googleVerified || e.split("@").length !== 2 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return "denied";
  if (row) return row.disabled || !isRole(row.role) ? "denied" : row.role;
  if (adminEmails().includes(e)) return "owner";
  if (isAllowedEmail(e)) return "pending";
  return "denied";
}

