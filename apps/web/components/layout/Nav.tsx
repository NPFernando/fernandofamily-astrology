"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { enabledFeatures } from "@/lib/feature-registry";
import { resolveKey } from "@/lib/i18n";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageSwitch } from "@/components/layout/LanguageSwitch";
import { DataSaverToggle } from "@/components/layout/DataSaverToggle";
import { HeritageMark } from "@/components/icons/heritage-mark";
import { groupedFeatures } from "@/lib/feature-groups";

const AccountMenu = dynamic(() => import("@/components/layout/AccountMenu").then((module) => module.AccountMenu), { ssr: false });
const InstallAppButton = dynamic(() => import("@/components/layout/InstallAppButton").then((module) => module.InstallAppButton), { ssr: false });

export function Nav() {
  const { locale, dict } = useLocale();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const features = enabledFeatures();
  const featureLabel = (id: string, fallback: string) => {
    if (id === "birth-nakshatra") return dict.nav.birthNakshatra;
    if (id === "pancha-pakshi") return dict.nav.panchaPakshi;
    if (id === "panchanga") return dict.nav.panchanga;
    if (id === "moon-calendar") return dict.nav.moonCalendar;
    if (id === "daily-guide") return dict.nav.dailyGuide;
    if (id === "family-almanac") return dict.nav.familyAlmanac;
    if (id === "muhurta") return dict.nav.muhurta;
    if (id === "divisional-charts") return dict.nav.divisionalCharts;
    if (id === "porondam") return dict.nav.porondam;
    if (id === "birth-chart") return dict.nav.birthChart;
    if (id === "horoscope-report") return dict.nav.horoscopeReport;
    if (id === "dasha") return dict.nav.dasha;
    return fallback;
  };
  const groups = groupedFeatures(features);
  const groupLabel = (id: string) => {
    if (id === "today") return dict.ui.todayTools;
    if (id === "birth") return dict.ui.birthTools;
    return dict.ui.familyTools;
  };

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  useEffect(() => {
    if (!mobileMenuOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);

  return (
    <header data-app-shell className="border-b border-black/10 dark:border-white/10">
      <nav className="mx-auto grid min-h-40 max-w-6xl gap-3 px-4 py-3 md:min-h-0 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
        <Link
          href={`/${locale}`}
          aria-current={pathname === `/${locale}` ? "page" : undefined}
          className="flex items-center gap-2 text-lg font-semibold leading-snug text-accent"
        >
          <HeritageMark className="h-8 w-8 shrink-0" />
          {dict.platform.name}
        </Link>
        <div
          className="relative z-10 hidden min-w-0 items-center gap-2 text-sm md:flex"
          aria-label={dict.ui.pageNavigation}
        >
          {groups.map((group) => {
            const active = group.features.some((feature) => isActive(`/${locale}${feature.route}`));
            return (
              <details key={group.id} className="group relative flex-none" open={active || undefined}>
                <summary
                  className={`flex cursor-pointer list-none items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1.5 leading-none transition [&::-webkit-details-marker]:hidden ${
                    active
                      ? "border-accent bg-accent/10 font-semibold text-accent"
                      : "border-transparent opacity-80 hover:border-black/10 hover:opacity-100 dark:hover:border-white/15"
                  }`}
                >
                  {groupLabel(group.id)} <span aria-hidden className="text-xs transition group-open:rotate-180">⌄</span>
                </summary>
                <div className="heritage-card absolute left-0 top-full z-30 mt-2 grid min-w-56 gap-1 rounded-xl border p-2 shadow-xl">
                  {group.features.map((feature) => {
                    const href = `/${locale}${feature.route}`;
                    return (
                      <Link
                        key={feature.id}
                        href={href}
                        aria-current={isActive(href) ? "page" : undefined}
                        className={`rounded-lg px-3 py-2 text-sm transition hover:bg-accent/10 ${isActive(href) ? "font-semibold text-accent" : ""}`}
                      >
                        {featureLabel(feature.id, resolveKey(dict, feature.titleKey))}
                      </Link>
                    );
                  })}
                </div>
              </details>
            );
          })}
          <Link href={`/${locale}/about`} className="flex-none whitespace-nowrap rounded-full px-3 py-1.5 opacity-80 hover:bg-accent/10 hover:opacity-100">
            {dict.nav.about}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-site-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/20 md:hidden"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
              {mobileMenuOpen ? (
                <>
                  <path d="m6 6 12 12" />
                  <path d="m18 6-12 12" />
                </>
              ) : (
                <>
                  <path d="M4 7h16" />
                  <path d="M4 12h16" />
                  <path d="M4 17h16" />
                </>
              )}
            </svg>
            {mobileMenuOpen ? dict.ui.close : dict.ui.menu}
          </button>
          <LanguageSwitch />
          <ThemeToggle />
          <DataSaverToggle />
          <InstallAppButton />
          <AccountMenu />
        </div>
        {mobileMenuOpen ? (
          <div
            id="mobile-site-navigation"
            className="heritage-card grid gap-5 rounded-2xl border p-4 text-sm md:hidden"
            aria-label={dict.ui.pageNavigation}
          >
            {groups.map((group) => (
              <section key={group.id} aria-labelledby={`mobile-nav-${group.id}`}>
                <h2 id={`mobile-nav-${group.id}`} className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-accent">
                  {groupLabel(group.id)}
                </h2>
                <div className="grid gap-1 sm:grid-cols-2">
                  {group.features.map((feature) => {
                    const href = `/${locale}${feature.route}`;
                    return (
                      <Link
                        key={feature.id}
                        href={href}
                        aria-current={isActive(href) ? "page" : undefined}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`rounded-lg px-3 py-2.5 transition hover:bg-accent/10 ${isActive(href) ? "bg-accent/10 font-semibold text-accent" : ""}`}
                      >
                        {featureLabel(feature.id, resolveKey(dict, feature.titleKey))}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
            <Link
              href={`/${locale}/about`}
              onClick={() => setMobileMenuOpen(false)}
              className={`rounded-lg border border-black/10 px-3 py-2.5 font-medium transition hover:bg-accent/10 dark:border-white/10 ${isActive(`/${locale}/about`) ? "bg-accent/10 text-accent" : ""}`}
            >
              {dict.nav.about}
            </Link>
          </div>
        ) : null}
      </nav>
    </header>
  );
}
