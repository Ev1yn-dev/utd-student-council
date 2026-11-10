import { NextResponse, type NextRequest } from "next/server";
import { audit, googleVerified, resolveAccess, syncProfile } from "@/lib/auth";
import { normalizeEmail } from "@/lib/env";
import { SITE_URL } from "@/lib/site";
import { RL_BYPASS_TTL_SEC, issueBypass, noProtectHint, rlBypassCookie } from "@/lib/rl-bypass";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const origin = SITE_URL; // redirects always go to the site address, never the request's Host
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const sb = await createClient();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/login?error=oauth`);

  const { data } = await sb.auth.getUser();
  const user = data.user;
  const email = normalizeEmail(user?.email);

  // Enforced HERE on the server (lib/env.ts decideAccess): Google-verified address with an active admin_users row,
  // listed in ADMIN_EMAILS (first sign-in -> owner), or on the school domain (no role yet -> /pending-access).
  // Anything else is logged out at once.
  const access = user && email && user.email_confirmed_at != null ? (await resolveAccess(user.id, email, googleVerified(user))).access : "denied";
  if (!user || access === "denied") {
    await sb.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  await syncProfile(user.id, email);
  // ip hash + user agent are added by audit() (shared accounts are used by several people)
  await audit({ email }, "auth.login", email, { role: access });
  const res = NextResponse.redirect(`${origin}${access === "pending" ? "/pending-access" : "/admin"}`);
  // back-office accounts (verified just above by Supabase + Google + admin_users): signed cookie that skips the app's
  // own rate limits and the public pages' copy / DevTools blocking for 12 h (lib/rl-bypass.ts)
  const bypass = access !== "pending" ? issueBypass(email) : null;
  if (bypass) {
    res.cookies.set(rlBypassCookie(bypass));
    res.cookies.set(noProtectHint());
    await audit({ email }, "auth.bypass.issue", email, { ttl_h: RL_BYPASS_TTL_SEC / 3600 });
  }
  return res;
}
