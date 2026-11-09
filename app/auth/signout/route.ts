import { NextResponse, type NextRequest } from "next/server";
import { audit } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { RL_BYPASS_COOKIE, RL_BYPASS_OLD_PATHS, rlBypassCookie, verifyBypass } from "@/lib/rl-bypass";
import { isSameOrigin } from "@/lib/security";
import { SITE_URL } from "@/lib/site";
import { logSecurity } from "@/lib/security-log";
import { createClient } from "@/lib/supabase/server";

/**
 * POST only, same origin only (CSRF). Form field scope=global signs the user out on every device (revokes all sessions).
 * Always removes an administrator's rate-limit bypass cookie (every path it was set on).
 */
const serialize = (c: ReturnType<typeof rlBypassCookie>) =>
  `${c.name}=${c.value}; Path=${c.path}; Max-Age=${c.maxAge}; HttpOnly; SameSite=Lax${c.secure ? "; Secure" : ""}`;

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req)) return new NextResponse("Forbidden", { status: 403 });
  const bypassEmail = verifyBypass(req.cookies.get(RL_BYPASS_COOKIE)?.value);
  if (supabaseConfigured()) {
    const global = (await req.formData().catch(() => null))?.get("scope") === "global";
    const db = await createClient();
    const { data } = await db.auth.getUser();
    await db.auth.signOut({ scope: global ? "global" : "local" });
    if (global && data.user) await logSecurity("logout_all", { userId: data.user.id });
    if (bypassEmail && data.user) await audit({ id: data.user.id, email: bypassEmail }, "rl_bypass:clear");
  }
  const res = NextResponse.redirect(`${SITE_URL}/`, { status: 303 });
  // Set-Cookie with one name per path: the old per-path cookies are cleared one response header each
  res.headers.append("set-cookie", serialize(rlBypassCookie("", 0)));
  for (const path of RL_BYPASS_OLD_PATHS) res.headers.append("set-cookie", serialize(rlBypassCookie("", 0, path)));
  res.headers.append("set-cookie", `utd_np=; Path=/; Max-Age=0; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res;
}
