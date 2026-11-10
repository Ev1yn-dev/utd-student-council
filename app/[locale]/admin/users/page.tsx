import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminUsers } from "@/components/admin/AdminUsers";
import { PageHeader } from "@/components/admin/stats/ui";
import { activeOwnerCount, listAdminUsers } from "@/lib/admin/users";
import { requirePermission } from "@/lib/auth";

/** users.manage: who may use the back office, their role, extra permissions, and whether the account is on. */
export default async function UsersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await requirePermission("users.manage");
  const [t, users, owners] = await Promise.all([getTranslations("admin.users"), listAdminUsers(), activeOwnerCount()]);
  return (
    <div className="max-w-6xl space-y-6">
      <PageHeader title={t("title")} lead={t("lead")} />
      <AdminUsers users={users} me={{ email: s.email, role: s.role, extra: s.extra, disabled: false }} owners={owners} />
    </div>
  );
}
