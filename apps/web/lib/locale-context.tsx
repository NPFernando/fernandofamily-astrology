"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getDictionary, type Locale, SUPPORTED_LOCALES } from "@/lib/i18n";

type Dictionary = ReturnType<typeof getDictionary>;

type LocaleContextValue = {
  locale: Locale;
  dict: Dictionary;
  switchLocale: (next: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

const LOCALE_COOKIE = "ff_locale";

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const dict = useMemo(() => getDictionary(locale), [locale]);

  const switchLocale = useCallback(
    (next: Locale) => {
      // Only the language code is persisted, never anything birth/location
      // related. Cookie mirrors localStorage so server-side middleware can
      // redirect unlocalized paths without a client round-trip.
      window.localStorage.setItem("ff_locale", next);
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
      const rest = SUPPORTED_LOCALES.some((l) => pathname.startsWith(`/${l}`))
        ? pathname.slice(3)
        : pathname;
      router.push(`/${next}${rest}`);
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ locale, dict, switchLocale }), [locale, dict, switchLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}
