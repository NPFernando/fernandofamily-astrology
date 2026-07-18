"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { enabledFeatures } from "@/lib/feature-registry";
import { resolveKey } from "@/lib/i18n";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { InstallAppButton } from "@/components/layout/InstallAppButton";

export function Nav() {
  const { locale, dict } = useLocale();
  const pathname = usePathname();
  const features = enabledFeatures();
  const featureLabel = (id: string, fallback: string) => {
    if (id === "birth-nakshatra") return dict.nav.birthNakshatra;
    if (id === "pancha-pakshi") return dict.nav.panchaPakshi;
    if (id === "panchanga") return dict.nav.panchanga;
    if (id === "moon-calendar") return dict.nav.moonCalendar;
    if (id === "daily-guide") return dict.nav.dailyGuide;
    if (id === "muhurta") return dict.nav.muhurta;
    if (id === "divisional-charts") return dict.nav.divisionalCharts;
    if (id === "porondam") return dict.nav.porondam;
    if (id === "birth-chart") return dict.nav.birthChart;
    if (id === "dasha") return dict.nav.dasha;
    return fallback;
  };
  const links = [
    ...features.map((f) => ({
      href: `/${locale}${f.route}`,
      label: featureLabel(f.id, resolveKey(dict, f.titleKey)),
    })),
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/methodology`, label: dict.nav.methodology },
  ];

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header data-app-shell className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto grid max-w-6xl gap-3 px-4 py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <Link
          href={`/${locale}`}
          aria-current={pathname === `/${locale}` ? "page" : undefined}
          className="text-lg font-semibold leading-snug text-amber-700 dark:text-amber-400"
        >
          {dict.platform.name}
        </Link>
        <div
          className="relative z-10 -mx-1 flex min-w-0 snap-x items-center gap-2 overflow-x-auto px-1 pb-1 text-sm md:mx-0 md:justify-start md:pb-0"
          aria-label={dict.ui.pageNavigation}
        >
          {links.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
                className={`relative z-10 flex-none snap-start whitespace-nowrap rounded-full border px-3 py-1.5 leading-none transition ${
                  active
                    ? "border-accent bg-accent/10 font-semibold text-accent"
                    : "border-transparent opacity-80 hover:border-black/10 hover:opacity-100 dark:hover:border-white/15"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <LanguageSwitch />
          <ThemeToggle />
          <InstallAppButton />
          <AccountMenu />
        </div>
      </nav>
    </header>
  );
}
