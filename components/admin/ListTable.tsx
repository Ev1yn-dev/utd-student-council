"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { reviewEntity } from "@/app/actions/content";
import { toast, usePending } from "@/components/admin/live";
import { RowActions } from "@/components/admin/RowActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useRouter } from "@/i18n/navigation";
import type { EntityKey, ReviewStatus } from "@/lib/admin/entities";
import { cn } from "@/lib/utils";

export type TableRow = {
  id: string; title: string; titleEn: string | null; sub: string; status: ReviewStatus; reason: string | null;
  canEdit: boolean; canDelete: boolean; editHref: string;
};

/**
 * Back-office list. Rows saved a moment ago from the form appear first (optimistic, "saving…") until the server
 * confirms. Staff can select rows and approve them together; keyboard: J/K move, X select, A approve, R reject.
 */
export function ListTable({ entity, year, rows, staff }: { entity: EntityKey; year: number; rows: TableRow[]; staff: boolean }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const pending = usePending(entity, year);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState(0);
  const [busy, start] = useTransition();
  const body = useRef<HTMLTableSectionElement>(null);
  const reviewable = rows.filter((r) => r.status !== "approved");

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const approveIds = (ids: string[]) => start(async () => {
    const results = await Promise.all(ids.map((id) => reviewEntity(entity, id, "approve", "")));
    const ok = results.filter((r) => r.ok).length;
    if (ok) toast({ tone: "ok", text: t("toast.approved", { n: ok }) });
    const bad = results.find((r) => !r.ok);
    if (bad && !bad.ok) toast({ tone: "error", text: t(`errors.${bad.error.key}`, bad.error.values) });
    setSelected(new Set());
    router.refresh();
  });

  // keyboard shortcuts (ignored while typing)
  const ref = useRef({ rows, focus, selected });
  useEffect(() => { ref.current = { rows, focus, selected }; });
  useEffect(() => {
    if (!staff) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return;
      const { rows: rs, focus: f } = ref.current;
      const k = e.key.toLowerCase();
      if (k === "j" || k === "k") {
        e.preventDefault();
        const n = Math.max(0, Math.min(rs.length - 1, f + (k === "j" ? 1 : -1)));
        setFocus(n);
        body.current?.querySelectorAll("tr[data-row]")[n]?.scrollIntoView({ block: "nearest" });
      } else if (k === "x" && rs[f]) { e.preventDefault(); toggle(rs[f].id); }
      else if (k === "a" && rs[f]) {
        e.preventDefault();
        const sel = [...ref.current.selected];
        approveIds(sel.length ? sel : [rs[f].id]);
      } else if (k === "r" && rs[f]) {
        e.preventDefault();
        body.current?.querySelectorAll<HTMLTableRowElement>("tr[data-row]")[f]?.querySelector<HTMLButtonElement>("button[data-reject]")?.click();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the latest rows/selection from the ref
  }, [staff]);

  return (
    <div className="space-y-2">
      {staff && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          <button
            type="button"
            disabled={!selected.size || busy}
            onClick={() => approveIds([...selected])}
            className="rounded-full bg-done px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {t("list.approveSelected", { n: selected.size })}
          </button>
          <span>{t("list.keys")}</span>
        </div>
      )}
      <div className="overflow-hidden rounded-[20px] border border-line bg-surface shadow-soft">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted">
            <tr>
              {staff && (
                <th scope="col" className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label={t("list.selectAll")}
                    checked={reviewable.length > 0 && reviewable.every((r) => selected.has(r.id))}
                    onChange={(e) => setSelected(e.target.checked ? new Set(reviewable.map((r) => r.id)) : new Set())}
                    className="h-4 w-4 accent-[var(--c-pink)]"
                  />
                </th>
              )}
              <th scope="col" className="px-4 py-3">{t("list.columns.title")}</th>
              <th scope="col" className="hidden px-4 py-3 sm:table-cell">{t("list.columns.status")}</th>
              <th scope="col" className="px-4 py-3 text-right">{t("list.columns.actions")}</th>
            </tr>
          </thead>
          <tbody ref={body} className="divide-y divide-line">
            {pending.map((p) => (
              <tr key={p.key} className="animate-pulse bg-sky/40">
                {staff && <td />}
                <td className="px-4 py-3 font-medium text-strong">{p.title}</td>
                <td className="hidden px-4 py-3 sm:table-cell"><span className="text-xs text-muted">{t("list.pendingSave")}</span></td>
                <td className="px-4 py-3 text-right text-xs text-muted sm:hidden">{t("list.pendingSave")}</td>
                <td className="hidden sm:table-cell" />
              </tr>
            ))}
            {rows.map((r, i) => (
              <tr key={r.id} data-row className={cn("align-top transition-colors", staff && focus === i && "bg-sky/50 outline outline-2 -outline-offset-2 outline-brand-mid/40")} onClick={() => setFocus(i)}>
                {staff && (
                  <td className="px-3 py-3">
                    <input type="checkbox" aria-label={t("list.select", { title: r.title })} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[var(--c-pink)]" />
                  </td>
                )}
                <td className="px-4 py-3">
                  <p className="font-medium text-strong">{r.title}</p>
                  <p className="text-xs text-muted">{r.sub}{r.titleEn !== null ? ` · ${r.titleEn}` : ""}</p>
                  {r.titleEn === null && <span className="mt-1 inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[0.7rem] text-muted">{t("list.noEnglish")}</span>}
                  <div className="mt-1 sm:hidden"><StatusBadge status={r.status} /></div>
                  {r.status === "rejected" && r.reason && <p className="mt-1 text-xs text-danger">{t("list.reason", { reason: r.reason })}</p>}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3">
                  <RowActions entity={entity} id={r.id} status={r.status} canReview={staff} canDelete={r.canDelete} canEdit={r.canEdit} editHref={r.editHref} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
