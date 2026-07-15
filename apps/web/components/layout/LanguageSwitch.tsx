"use client";

import { useLocale } from "@/lib/locale-context";

export function LanguageSwitch() {
  const { locale, switchLocale, dict } = useLocale();
  return (
    <div
      className="inline-flex items-center rounded-full border border-black/10 p-0.5 text-xs dark:border-white/15 sm:text-sm"
      role="group"
      aria-label={dict.ui.languageSwitch}
    >
      <button
        type="button"
        onClick={() => switchLocale("si")}
        aria-pressed={locale === "si"}
        className={`rounded-full px-2.5 py-1 ${
          locale === "si" ? "bg-accent text-white" : "opacity-70 hover:opacity-100"
        }`}
      >
        සිංහල
      </button>
      <button
        type="button"
        onClick={() => switchLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-full px-2.5 py-1 ${
          locale === "en" ? "bg-accent text-white" : "opacity-70 hover:opacity-100"
        }`}
      >
        English
      </button>
    </div>
  );
}
