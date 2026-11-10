// Creates the two test users in Supabase (confirmed, email_verified) and stores a real signed-in session for each
// as Playwright storage state. Cookies are produced by @supabase/ssr itself, exactly as the app would set them.
// Also generates the test images (no binary fixtures in git).
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { ADMIN, COUNCIL, env } from "./env";

async function makeImages() {
  mkdirSync("e2e/.auth/img", { recursive: true });
  const colors = ["#1D3B8B", "#E8508B", "#D4AF37", "#3a9d6a"];
  for (const [i, c] of colors.entries()) {
    const label = Buffer.from(`<svg width="2400" height="1500"><text x="80" y="300" font-size="220" fill="white">E2E ${i + 1}</text></svg>`);
    await sharp({ create: { width: 2400, height: 1500, channels: 3, background: c } })
      .composite([{ input: label }])
      .jpeg({ quality: 85 })
      .toFile(`e2e/.auth/img/photo-${i + 1}.jpg`);
  }
}

export default async function globalSetup() {
  await makeImages();
  const url = env.NEXT_PUBLIC_SUPABASE_URL, anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  for (const [email, file, role] of [[ADMIN, "admin", null], [COUNCIL, "council", "council"]] as const) {
    const password = randomBytes(24).toString("base64url");
    const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((u) => u.email === email);
    const meta = { user_metadata: { email_verified: true }, email_confirm: true, password };
    const { data, error } = existing
      ? await admin.auth.admin.updateUserById(existing.id, meta)
      : await admin.auth.admin.createUser({ email, ...meta });
    if (error || !data.user) throw new Error(`create ${email}: ${error?.message}`);
    await admin.from("profiles").upsert({ id: data.user.id, email, role: role ? "teacher" : null });
    // roles come from admin_users (the admin: ADMIN_EMAILS of the test server -> owner on first sign-in);
    // the council test account is an editor
    if (role) await admin.from("admin_users").upsert({ email, role: "editor", disabled: false, created_by: "e2e" });

    const jar = new Map<string, string>();
    const sb = createServerClient(url, anon, {
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    const { error: e2 } = await sb.auth.signInWithPassword({ email, password });
    if (e2) throw new Error(`sign in ${email}: ${e2.message}`);
    const cookies = [...jar].map(([name, value]) => ({
      name, value, domain: "localhost", path: "/", expires: -1, httpOnly: false, secure: false, sameSite: "Lax" as const,
    }));
    writeFileSync(`e2e/.auth/${file}.json`, JSON.stringify({ cookies, origins: [] }));
  }
}
