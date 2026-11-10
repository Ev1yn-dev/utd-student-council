import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Illustration } from "@/components/icons/Illustration";
import { getSession } from "@/lib/auth";
import { redirect } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return { title: (await getTranslations({ locale: (await params).locale, namespace: "meta" }))("pendingTitle") };
}

export default async function PendingAccessPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth" });
  const s = await getSession();
  if (!s) return redirect({ href: "/login", locale });
  if (s.role) return redirect({ href: "/admin", locale });
  return (
    <div className="space-y-5">
      <Illustration name="pending" className="h-28 w-auto" />
      <div>
        <h1 className="text-2xl font-bold text-strong">{t("pendingTitle")}</h1>
        <p className="mt-2 text-muted">{t("pendingBody", { email: s.email })}</p>
      </div>
      <form action="/auth/signout" method="post">
        <button type="submit" className="rounded-full border-2 border-brand px-6 py-2.5 font-medium hover:bg-brand hover:text-on-brand">{t("signOut")}</button>
      </form>
    </div>
  );
}
