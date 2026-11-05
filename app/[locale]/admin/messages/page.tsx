import { AlertTriangle, Calendar, Filter, Search } from "lucide-react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { ICON } from "@/components/admin/icon";
import { MessageControls } from "@/components/admin/MessageControls";
import { ErrorNote, PageHeader } from "@/components/admin/stats/ui";
import { Link } from "@/i18n/navigation";
import { audit, requireRole } from "@/lib/auth";
import { VOICE_CATEGORIES } from "@/lib/site";
import { PAGE_SIZE, listMessages, messageRooms, type MessageFilters } from "@/lib/voice-admin";
import { cn } from "@/lib/utils";

type SP = { grade?: string; room?: string; topic?: string; from?: string; to?: string; q?: string; unread?: string; flagged?: string; page?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function filters(sp: SP): MessageFilters {
  const grade = Number(sp.grade);
  return {
    grade: grade >= 1 && grade <= 6 ? grade : undefined,
    room: sp.room && /^[\w./-]{1,10}$/.test(sp.room) ? sp.room : undefined,
    topic: sp.topic && sp.topic in VOICE_CATEGORIES ? sp.topic : undefined,
    from: sp.from && DATE.test(sp.from) ? sp.from : undefined,
    to: sp.to && DATE.test(sp.to) ? sp.to : undefined,
    q: sp.q?.trim().slice(0, 80) || undefined,
    unread: sp.unread === "1",
    flagged: sp.flagged === "1",
    page: Math.max(1, Math.min(1000, Number(sp.page) || 1)),
  };
}

/** Admin only: every council voice message with its sender. Each view is written to audit_logs. */
export default async function MessagesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const s = await requireRole(["admin"]);
  const [t, tv, f] = await Promise.all([getTranslations("inbox"), getTranslations("voice"), getFormatter()]);
  const fl = filters(sp);
  const [data, rooms] = await Promise.all([
    listMessages(fl).catch((e: Error) => (console.error("[admin] messages", e.message), null)),
    messageRooms().catch(() => [] as string[]),
  ]);
  // who looked, when, with which filters (never names, IDs or the search text)
  await audit(s, "voice.view", "voice_messages", undefined, {
    page: fl.page, grade: fl.grade ?? null, room: fl.room ?? null, topic: fl.topic ?? null, from: fl.from ?? null, to: fl.to ?? null,
    search: !!fl.q, unread: fl.unread, flagged: fl.flagged, shown: data?.rows.length ?? 0,
  });

  const topic = (k: string) => (k in VOICE_CATEGORIES ? tv(`categories.${VOICE_CATEGORIES[k as keyof typeof VOICE_CATEGORIES]}`) : k);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const query = (page: number) => ({ ...Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== "page" && v)), page: String(page) });
  const field = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm";

  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("title")} lead={t("lead")} />

      <form method="get" aria-label={t("filters.label")} className="grid gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-muted">
          {t("filters.grade")}
          <select name="grade" defaultValue={sp.grade ?? ""} className={cn(field, "mt-1 text-ink")}>
            <option value="">{t("filters.all")}</option>
            {[1, 2, 3, 4, 5, 6].map((g) => <option key={g} value={g}>{tv("gradeLabel", { g })}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          {t("filters.room")}
          <select name="room" defaultValue={sp.room ?? ""} className={cn(field, "mt-1 text-ink")}>
            <option value="">{t("filters.all")}</option>
            {rooms.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          {t("filters.topic")}
          <select name="topic" defaultValue={sp.topic ?? ""} className={cn(field, "mt-1 text-ink")}>
            <option value="">{t("filters.all")}</option>
            {Object.keys(VOICE_CATEGORIES).map((k) => <option key={k} value={k}>{topic(k)}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          <span className="flex items-center gap-2"><Search {...ICON} size={16} />{t("filters.q")}</span>
          <input name="q" type="search" defaultValue={sp.q ?? ""} placeholder={t("filters.qPlaceholder")} className={cn(field, "mt-1 text-ink")} />
        </label>
        <label className="text-xs text-muted">
          <span className="flex items-center gap-2"><Calendar {...ICON} size={16} />{t("filters.from")}</span>
          <input name="from" type="date" defaultValue={sp.from ?? ""} className={cn(field, "mt-1 text-ink")} />
        </label>
        <label className="text-xs text-muted">
          <span className="flex items-center gap-2"><Calendar {...ICON} size={16} />{t("filters.to")}</span>
          <input name="to" type="date" defaultValue={sp.to ?? ""} className={cn(field, "mt-1 text-ink")} />
        </label>
        <div className="flex flex-col justify-end gap-1.5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="unread" value="1" defaultChecked={fl.unread} className="h-4 w-4" />{t("filters.unread")}</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="flagged" value="1" defaultChecked={fl.flagged} className="h-4 w-4" />{t("filters.flagged")}</label>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-on-brand">
            <Filter {...ICON} />
            {t("filters.apply")}
          </button>
          <Link href="/admin/messages" className="rounded-full px-3 py-2 text-sm text-muted hover:text-ink">{t("filters.clear")}</Link>
        </div>
      </form>

      {!data ? (
        <ErrorNote text={t("errors.load")} />
      ) : (
        <>
          <p className="text-sm text-muted">{t("count", { n: f.number(data.total) })}</p>
          {data.rows.length === 0 ? (
            <p className="rounded-[20px] bg-surface-2 px-4 py-10 text-center text-sm text-muted">{t("empty")}</p>
          ) : (
            <ul className="space-y-3">
              {data.rows.map((m) => {
                const name = [m.sender_prefix, m.sender_first_name, m.sender_last_name].filter(Boolean).join(" ");
                const cls = m.grade ? `${tv("gradeLabel", { g: m.grade })}${m.sender_room ? `/${m.sender_room}` : ""}` : "—";
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-[20px] border bg-surface p-4 shadow-soft",
                      m.flagged ? "border-danger/40 bg-pink-soft/40" : m.read_at ? "border-line" : "border-pink/40",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      {!m.read_at && <span className="rounded-full bg-pink px-2 py-0.5 font-semibold text-white">{t("new")}</span>}
                      {m.flagged && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2 py-0.5 font-semibold text-white">
                          <AlertTriangle {...ICON} size={14} />
                          {t("flag")}
                        </span>
                      )}
                      <time dateTime={m.created_at}>{f.dateTime(new Date(m.created_at), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" })}</time>
                      <span aria-hidden>·</span>
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-ink">{topic(m.category)}</span>
                      <span aria-hidden>·</span>
                      <span>{t("ref")} <span className="font-mono">{m.ref_code}</span></span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-ink">{m.message}</p>
                    <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                      {m.student_id ? (
                        <>
                          <div><dt className="text-xs text-muted">{t("name")}</dt><dd className="font-medium">{name || "—"}</dd></div>
                          <div><dt className="text-xs text-muted">{t("class")}</dt><dd>{cls}</dd></div>
                          <div><dt className="text-xs text-muted">{t("id")}</dt><dd className="font-mono">{m.student_id}</dd></div>
                        </>
                      ) : (
                        <div className="sm:col-span-3"><dd className="text-muted">{t("anonymousOld")}</dd></div>
                      )}
                    </dl>
                    <div className="mt-3 border-t border-line pt-3">
                      <MessageControls id={m.id} read={!!m.read_at} canBlock={!!m.student_id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {pages > 1 && (
            <nav className="flex items-center justify-between text-sm" aria-label={t("page", { page: fl.page, pages })}>
              {fl.page > 1 ? <Link href={{ pathname: "/admin/messages", query: query(fl.page - 1) }} className="rounded-full border border-line px-4 py-2">{t("prev")}</Link> : <span />}
              <span className="text-muted">{t("page", { page: fl.page, pages })}</span>
              {fl.page < pages ? <Link href={{ pathname: "/admin/messages", query: query(fl.page + 1) }} className="rounded-full border border-line px-4 py-2">{t("next")}</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
