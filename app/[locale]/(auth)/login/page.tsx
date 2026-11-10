import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Illustration } from "@/components/icons/Illustration";
import { getSession } from "@/lib/auth";
import { allowedDomain, supabaseConfigured } from "@/lib/env";
import { redirect } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: (await getTranslations({ locale: (await params).locale, namespace: "meta" }))("loginTitle") };
}

function GoogleMark() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ error?: string }> }) {
  const [{ locale }, { error }] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "auth" });
  const s = await getSession();
  if (s) redirect({ href: s.role ? "/admin" : "/pending-access", locale });
  const ok = supabaseConfigured();
  const key = !ok ? "config" : error === "domain" || error === "oauth" || error === "config" ? error : error ? "oauth" : null;
  const msg = key ? t(`errors.${key}`, { domain: allowedDomain() }) : null;

  return (
    <div className="space-y-5">
      <Illustration name="login" className="h-24 w-auto" />
      <div>
        <h1 className="text-2xl font-bold text-strong">{t("loginTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("loginSub")}</p>
      </div>
      {msg && <p role="alert" className="rounded-md border border-danger/40 bg-pink-soft px-4 py-3 text-sm font-medium text-danger">{msg}</p>}
      {/* plain link (GET): the OAuth hand-off is a redirect from the server, so CSP form-action stays 'self' */}
      <a
        href={ok ? "/auth/google" : undefined}
        aria-disabled={!ok}
        className={`flex w-full items-center justify-center gap-3 rounded-full border-2 border-brand bg-surface px-6 py-3.5 font-display text-lg font-semibold text-ink transition-colors hover:bg-brand hover:text-on-brand ${ok ? "" : "pointer-events-none opacity-60"}`}
      >
        <GoogleMark />
        {t("google")}
      </a>
      <p className="text-xs text-muted">{t("noSignup")}</p>
    </div>
  );
}
