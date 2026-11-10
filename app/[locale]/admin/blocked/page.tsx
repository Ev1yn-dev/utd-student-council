import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { BadWords, UnblockButton } from "@/components/admin/MessageControls";
import { Card, PageHeader } from "@/components/admin/stats/ui";
import { hasPermission, requirePermission } from "@/lib/auth";
import { badWords, listBlocks } from "@/lib/voice-admin";

/** senders.block: blocked senders of council voice (lift a block) and the word list that flags messages. */
export default async function BlockedPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await requirePermission("senders.block");
  const identity = hasPermission(s, "messages.identity.view");
  const [ti, tv, ta, f, blocks, words] = await Promise.all([
    getTranslations("inbox"), getTranslations("voice"), getTranslations("admin.blocked"), getFormatter(),
    listBlocks().catch((e: Error) => (console.error("[admin] blocks", e.message), [])),
    badWords(true).catch(() => [] as string[]),
  ]);
  const when = (v: string) => f.dateTime(new Date(v), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={ti("blocks.title")} lead={ta("lead")} />
      <Card title={ti("blocks.title")} aside={String(blocks.length)}>
        {blocks.length ? (
          <ul className="divide-y divide-line">
            {blocks.map((b) => {
              const p = b.person;
              const who = !identity ? ta("hidden") : p ? [p.prefix, p.first_name, p.last_name].filter(Boolean).join(" ") : ti("blocks.unknown");
              const cls = identity && p ? `${tv("gradeLabel", { g: Number(p.grade) })}${p.room ? `/${p.room}` : ""}` : "";
              return (
                <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="font-medium">{who} {identity && <span className="font-normal text-muted">{cls} · <span className="font-mono">{b.student_id}</span></span>}</p>
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
          <p className="text-sm text-muted">{ti("blocks.none")}</p>
        )}
      </Card>
      <Card title={ti("words.title")}>
        <p className="mb-3 text-sm text-muted">{ti("words.lead")}</p>
        <BadWords words={words} />
      </Card>
    </div>
  );
}
