"use client";

import { useLocale } from "@/lib/locale-context";

export function LanguageSwitch() {
  const { locale, switchLocale } = useLocale();
  return (
    <div className="flex items-center gap-1 text-sm" role="group" aria-label="Language">
      <button
        type="button"
        onClick={() => switchLocale("en")}
        aria-pressed={locale === "en"}
        className={locale === "en" ? "font-semibold underline" : "opacity-70"}
      >
        English
      </button>
      <span aria-hidden="true">|</span>
      <button
        type="button"
        onClick={() => switchLocale("si")}
        aria-pressed={locale === "si"}
        className={locale === "si" ? "font-semibold underline" : "opacity-70"}
      >
        සිංහල
      </button>
    </div>
  );
}
