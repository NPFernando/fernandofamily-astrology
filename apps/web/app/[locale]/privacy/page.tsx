import type { Metadata } from "next";
import { getDictionary } from "@/lib/i18n";
import { localizedPageMetadata, resolveLocale } from "@/lib/page-metadata";
import { ClearPreferencesButton } from "@/components/ClearPreferencesButton";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return localizedPageMetadata(params, "privacy", "/privacy");
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const dict = getDictionary(await resolveLocale(params));
  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{dict.pages.privacy.title}</h1>
      <p className="mt-4 leading-relaxed">{dict.pages.privacy.noAccounts}</p>
      <p className="mt-4 leading-relaxed">{dict.pages.privacy.accountsBody}</p>
      <p className="mt-4 leading-relaxed">{dict.pages.privacy.birthDataHandling}</p>
      <h2 className="mt-6 text-lg font-semibold">{dict.pages.privacy.localStorageTitle}</h2>
      <p className="mt-2 leading-relaxed">{dict.pages.privacy.localStorageBody}</p>
      <ClearPreferencesButton
        label={dict.ui.clearSavedPreferences}
        clearedMessage={dict.pages.privacy.clearAction}
      />
    </article>
  );
}
