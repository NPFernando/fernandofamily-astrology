"use client";

import { useTheme } from "@/lib/theme-context";
import { useLocale } from "@/lib/locale-context";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { dict } = useLocale();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? dict.ui.switchToLightMode : dict.ui.switchToDarkMode}
      className="rounded-full border border-black/10 px-3 py-1.5 text-sm dark:border-white/20"
      suppressHydrationWarning
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
