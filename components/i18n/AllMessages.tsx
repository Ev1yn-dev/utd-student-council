import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";

/**
 * Back office (admin, dashboard): gives its client components every message namespace. Public pages only get the
 * public ones from app/[locale]/layout.tsx (PUBLIC_MESSAGES), so admin strings are never sent to visitors.
 */
export async function AllMessages({ children }: { children: React.ReactNode }) {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);
  return <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">{children}</NextIntlClientProvider>;
}
