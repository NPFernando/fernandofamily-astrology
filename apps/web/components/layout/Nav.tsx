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
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href={`/${locale}`} className="text-lg font-semibold text-amber-700 dark:text-amber-400">
          {dict.platform.name}
        </Link>
        <div className="flex flex-wrap items-center gap-4 text-sm">
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
        <div className="flex items-center gap-3">
          <LanguageSwitch />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}
