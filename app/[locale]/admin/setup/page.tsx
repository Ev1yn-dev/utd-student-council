import { AlertTriangle, CircleCheck, CircleHelp, CircleX } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ICON } from "@/components/admin/icon";
import { activeSharedAccounts } from "@/lib/admin/users";
import { requireRole } from "@/lib/auth";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "@/lib/env";
import { ENV_VARS, envStatus, type EnvStatus } from "@/lib/env-spec";
import { cn } from "@/lib/utils";

type Status = EnvStatus | "unknown";
const BADGE = { set: CircleCheck, test: AlertTriangle, missing: CircleX, unknown: CircleHelp } satisfies Record<Status, unknown>;
const TONE: Record<Status, string> = {
  set: "bg-done/12 text-done", test: "bg-progress/15 text-progress", missing: "bg-danger/10 text-danger", unknown: "bg-surface-2 text-muted",
};

/** Google provider on/off from Supabase's public auth settings (no secrets involved). */
async function googleStatus(): Promise<Status> {
  if (!supabaseConfigured()) return "unknown";
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY }, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!r.ok) return "unknown";
    const j = (await r.json()) as { external?: { google?: boolean } };
    return j.external?.google ? "set" : "missing";
  } catch {
    return "unknown";
  }
}

/**
 * Configuration status for administrators. Only a status per variable is rendered — values never leave the server
 * (this is a server component; nothing but the status string and help text is sent to the browser).
 */
export default async function SetupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const t = await getTranslations("setup");
  const rows = ENV_VARS.map((v) => ({ v, status: envStatus(v) as Status }));
  const [google, shared] = await Promise.all([googleStatus(), activeSharedAccounts()]);

  // plain render helper (not a component), keyed by the caller
  const row = ({ name, status, url, need, pub }: { name: string; status: Status; url?: string; need?: "required" | "optional"; pub?: boolean }) => (
    <li key={name} className="rounded-[20px] border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-surface-2 px-2 py-0.5 font-mono text-sm font-semibold text-strong">{name}</code>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[status])}>
          {(() => {
            const B = BADGE[status];
            return <B {...ICON} size={14} />;
          })()}
          {t(`status.${status}`)}
        </span>
        {need && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{t(`need.${need}`)}</span>}
        {pub !== undefined && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{t(pub ? "exposure.public" : "exposure.secret")}</span>}
      </div>
      <dl className="mt-3 grid gap-1.5 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="font-medium text-muted">{t("labels.purpose")}</dt><dd>{t.raw(`vars.${name}.purpose`) as string}</dd>
        <dt className="font-medium text-muted">{t("labels.where")}</dt>
        <dd className="break-words">
          {t.raw(`vars.${name}.where`) as string}
          {url && <> — <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-pink-ink underline-offset-4 hover:underline">{t("labels.open")} ↗</a></>}
        </dd>
        {status !== "set" && (
          <>
            <dt className="font-medium text-muted">{t("labels.missingDev")}</dt><dd>{t.raw(`vars.${name}.missingDev`) as string}</dd>
            <dt className="font-medium text-muted">{t("labels.missingProd")}</dt><dd>{t.raw(`vars.${name}.missingProd`) as string}</dd>
          </>
        )}
      </dl>
    </li>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-strong">{t("title")}</h1>
        <p className="text-sm text-muted">{t("sub")}</p>
        <p className="mt-1 text-xs text-muted">{t("mode", { mode: process.env.NODE_ENV ?? "?" })} · {t("restart")}</p>
      </header>
      {shared.length > 0 && (
        <div role="note" className="rounded-[20px] border border-progress/40 bg-progress/10 p-4 text-sm">
          <p className="font-semibold text-strong">{t("sharedTitle")}</p>
          <p className="mt-1 text-ink">{t("sharedBody", { emails: shared.join(", ") })}</p>
        </div>
      )}
      <ul className="space-y-3">
        {rows.map(({ v, status }) => row({ name: v.name, status, url: v.url, need: v.need, pub: v.public }))}
        {row({ name: "GOOGLE_OAUTH", status: google, url: "https://supabase.com/dashboard/project/_/auth/providers" })}
      </ul>
    </div>
  );
}
