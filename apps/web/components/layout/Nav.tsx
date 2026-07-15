"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-context";
import { enabledFeatures } from "@/lib/feature-registry";
import { resolveKey } from "@/lib/i18n";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { AccountMenu } from "@/components/layout/AccountMenu";

export function Nav() {
  const { locale, dict } = useLocale();
  const features = enabledFeatures();

  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto grid max-w-5xl gap-3 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <Link
          href={`/${locale}`}
          className="text-lg font-semibold leading-snug text-amber-700 dark:text-amber-400"
        >
          {dict.platform.name}
        </Link>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm md:justify-center">
          {features.map((f) => (
            <Link key={f.id} href={`/${locale}${f.route}`} className="hover:underline">
              {resolveKey(dict, f.titleKey)}
            </Link>
          ))}
          <Link href={`/${locale}/about`} className="hover:underline">
            {dict.nav.about}
          </Link>
          <Link href={`/${locale}/methodology`} className="hover:underline">
            {dict.nav.methodology}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <LanguageSwitch />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}
