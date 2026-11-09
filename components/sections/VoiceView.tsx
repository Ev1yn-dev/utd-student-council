"use client";

import { useTranslations } from "next-intl";
import { VoiceForm } from "@/components/sections/VoiceForm";
import { VoiceTracker } from "@/components/sections/VoiceTracker";

export function VoiceView() {
  const t = useTranslations("voice");
  return (
    <div className="mx-auto max-w-[1320px] px-4 py-6 md:py-8">
      <header data-swap className="mb-6">
        <h1 className="text-2xl font-semibold text-strong md:text-3xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("sub")}</p>
        <p className="mt-2 max-w-3xl text-sm text-muted">{t("intro")}</p>
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
        <VoiceForm />
        <div className="space-y-6">
          <VoiceTracker />
          <p data-swap className="text-sm text-muted">{t("privacy")}</p>
        </div>
      </div>
    </div>
  );
}
