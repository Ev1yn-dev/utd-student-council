"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { deleteEntity, reviewEntity, type Result } from "@/app/actions/content";
import { Link, useRouter } from "@/i18n/navigation";
import type { EntityKey, ReviewStatus } from "@/lib/admin/entities";
import { cn } from "@/lib/utils";

const btn = "rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50";

/** Edit / delete for authors, approve / reject (with reason) / hide for staff. */
export function RowActions({
  entity, id, status, canReview, canDelete, canEdit, editHref,
}: { entity: EntityKey; id: string; status: ReviewStatus; canReview: boolean; canDelete: boolean; canEdit: boolean; editHref: string }) {
  const t = useTranslations("dashboard");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.ok) {
        setRejecting(false);
        router.refresh();
      } else setError(t(`errors.${r.error.key}`, r.error.values));
    });

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {canEdit && <Link href={editHref} className={cn(btn, "border border-line bg-surface text-ink hover:border-pink hover:text-pink-ink")}>{t("list.edit")}</Link>}
        {canReview && status !== "approved" && (
          <button type="button" disabled={pending} onClick={() => run(() => reviewEntity(entity, id, "approve", ""))} className={cn(btn, "bg-done text-white hover:brightness-110")}>
            {t("review.approve")}
          </button>
        )}
        {canReview && status !== "rejected" && (
          <button type="button" data-reject disabled={pending} onClick={() => setRejecting((v) => !v)} className={cn(btn, "border border-danger/40 text-danger hover:bg-danger/10")}>
            {t("review.reject")}
          </button>
        )}
        {canReview && status === "approved" && (
          <button type="button" disabled={pending} onClick={() => run(() => reviewEntity(entity, id, "hide", ""))} className={cn(btn, "border border-line text-muted hover:text-ink")}>
            {t("review.hide")}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm(t("review.confirmDelete")) && run(() => deleteEntity(entity, id))}
            className={cn(btn, "text-muted hover:text-danger")}
          >
            {t("review.delete")}
          </button>
        )}
      </div>
      {rejecting && (
        <form
          className="flex w-full max-w-xs flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => reviewEntity(entity, id, "reject", reason));
          }}
        >
          <label className="text-xs text-muted">
            {t("review.reasonLabel")}
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} maxLength={500} required className="mt-1 w-full rounded-lg border border-line bg-surface p-2 text-sm text-ink" />
          </label>
          <div className="flex justify-end gap-1.5">
            <button type="button" onClick={() => setRejecting(false)} className={cn(btn, "text-muted")}>{t("review.cancel")}</button>
            <button type="submit" disabled={pending} className={cn(btn, "bg-danger text-white")}>{t("review.confirmReject")}</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
