import { ArrowRight } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ICON } from "@/components/admin/icon";
import { requireRole } from "@/lib/auth";
import { BadWords, UnblockButton } from "@/components/admin/MessageControls";
import { adminClient } from "@/lib/supabase/admin";
import { badWords, listBlocks } from "@/lib/voice-admin";

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString();

type Event = { kind: string; path: string | null; ip_hash: string | null; created_at: string };
type RoleChange = { actor_email: string | null; detail: { email?: string; from?: string | null; to?: string | null }; created_at: string };

/** Admin only: last 7 days of security events + role changes, and "sign out on every device". */
export default async function SecurityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireRole(["admin"]);
  const t = await getTranslations("security");
  const f = await getFormatter();
  const since = daysAgo(7);
  const db = adminClient();
  const [{ data: ev }, { data: roles }] = await Promise.all([
    db.from("security_events" as never).select("kind,path,ip_hash,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(500),
    db.from("audit_logs").select("actor_email,detail,created_at").eq("action", "role.change").gte("created_at", since).order("created_at", { ascending: false }).limit(50),
  ]);
  const [ti, tv, blocks, words] = await Promise.all([
    getTranslations("inbox"),
    getTranslations("voice"),
    listBlocks().catch((e: Error) => (console.error("[admin] blocks", e.message), [])),
    badWords(true).catch(() => [] as string[]),
  ]);
  const events = (ev ?? []) as unknown as Event[];
  const counts = Object.entries(events.reduce<Record<string, number>>((m, e) => ((m[e.kind] = (m[e.kind] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
  const when = (s: string) => f.dateTime(new Date(s), { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("lead")}</p>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">{t("summary")}</h2>
        {counts.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {counts.map(([k, n]) => (
              <li key={k} className="rounded-xl bg-surface-2 px-3 py-2">
                <span className="block text-2xl font-semibold tabular-nums">{n}</span>
                <span className="text-sm text-muted">{t.has(`kinds.${k}`) ? t(`kinds.${k}`) : k}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("none")}</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">{t("recent")}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted"><tr><th className="py-1 pr-3">{t("time")}</th><th className="pr-3">{t("kind")}</th><th className="pr-3">{t("path")}</th><th>{t("source")}</th></tr></thead>
            <tbody>
              {events.slice(0, 50).map((e, i) => (
                <tr key={i} className="border-t border-line">
                  <td className="whitespace-nowrap py-1.5 pr-3">{when(e.created_at)}</td>
                  <td className="pr-3">{t.has(`kinds.${e.kind}`) ? t(`kinds.${e.kind}`) : e.kind}</td>
                  <td className="max-w-[16rem] truncate pr-3 font-mono text-xs">{e.path ?? "—"}</td>
                  <td className="font-mono text-xs">{e.ip_hash?.slice(0, 8) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">{t("roles")}</h2>
        {(roles ?? []).length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {(roles as unknown as RoleChange[]).map((r, i) => (
              <li key={i}>
                {when(r.created_at)} · <b>{r.detail.email}</b>: <span className="inline-flex items-center gap-1">{r.detail.from ?? "—"}<ArrowRight {...ICON} size={14} />{r.detail.to ?? "—"}</span> <span className="text-muted">({r.actor_email ?? "system"})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("none")}</p>
        )}
      </section>

      <section className="rounded-2xl border border-danger/30 bg-surface p-5">
        <h2 className="font-semibold">{t("logoutAll")}</h2>
        <p className="mt-1 text-sm text-muted">{t("logoutAllHelp")}</p>
        <form action="/auth/signout" method="post" className="mt-3">
          <input type="hidden" name="scope" value="global" />
          <button type="submit" className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-white">{t("logoutAll")}</button>
        </form>
      </section>
      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">{ti("blocks.title")}</h2>
        {blocks.length ? (
          <ul className="mt-3 divide-y divide-line">
            {blocks.map((b) => {
              const p = b.person;
              const who = p ? [p.prefix, p.first_name, p.last_name].filter(Boolean).join(" ") : ti("blocks.unknown");
              const cls = p ? `${tv("gradeLabel", { g: Number(p.grade) })}${p.room ? `/${p.room}` : ""}` : "";
              return (
                <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="font-medium">{who} <span className="font-normal text-muted">{cls} · <span className="font-mono">{b.student_id}</span></span></p>
                    <p><span className="text-muted">{ti("blocks.reason")}:</span> {b.reason}</p>
                    <p className="text-xs text-muted">
                      {b.until ? ti("blocks.until", { date: when(b.until) }) : ti("blocks.forever")} · {ti("blocks.by", { email: b.created_by })} · {when(b.created_at)}
                    </p>
                  </div>
                  <UnblockButton id={b.id} />
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{ti("blocks.none")}</p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">{ti("words.title")}</h2>
        <p className="mb-3 mt-1 text-sm text-muted">{ti("words.lead")}</p>
        <BadWords words={words} />
      </section>
    </div>
  );
}
