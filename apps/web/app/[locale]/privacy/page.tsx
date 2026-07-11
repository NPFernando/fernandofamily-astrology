"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { clearSavedPreferences } from "@/lib/preferences";

export default function PrivacyPage() {
  const { dict } = useLocale();
  const [cleared, setCleared] = useState(false);

  return (
    <article className="max-w-2xl">
      <h1 className="text-2xl font-bold">{dict.pages.privacy.title}</h1>
      <p className="mt-4 leading-relaxed">{dict.pages.privacy.noAccounts}</p>
      <p className="mt-4 leading-relaxed">{dict.pages.privacy.birthDataHandling}</p>
      <h2 className="mt-6 text-lg font-semibold">{dict.pages.privacy.localStorageTitle}</h2>
      <p className="mt-2 leading-relaxed">{dict.pages.privacy.localStorageBody}</p>
      <button
        type="button"
        onClick={() => {
          clearSavedPreferences();
          setCleared(true);
        }}
        className="mt-6 rounded-full border border-black/10 px-4 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
      >
        {dict.ui.clearSavedPreferences}
      </button>
      {cleared && <p className="mt-2 text-sm text-accent">{dict.pages.privacy.clearAction}</p>}
    </article>
  );
}
