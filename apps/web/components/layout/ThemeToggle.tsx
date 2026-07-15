"use client";

import { useTheme } from "@/lib/theme-context";
import { useLocale } from "@/lib/locale-context";
import { saveAccountPreferences } from "@/lib/account-preferences";
import { useSessionProbe } from "@/lib/use-session-probe";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { dict } = useLocale();
  const probe = useSessionProbe();
  const signedIn = Boolean(probe.user?.email);

  function onToggle() {
    const next = toggleTheme();
    if (signedIn) void saveAccountPreferences({ theme: next });
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={theme === "dark" ? dict.ui.switchToLightMode : dict.ui.switchToDarkMode}
      className="rounded-full border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
      suppressHydrationWarning
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
