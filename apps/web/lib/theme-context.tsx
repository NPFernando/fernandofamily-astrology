"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

function detectInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = window.localStorage.getItem("ff_theme") as Theme | null;
  return saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(detectInitialTheme);

  // DOM-only side effect (no setState here) — keeps <html> in sync whenever
  // theme changes, including the initial client-detected value above.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem("ff_theme", next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
