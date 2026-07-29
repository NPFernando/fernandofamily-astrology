"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDataSaver } from "@/lib/data-saver-context";
import { useLocale } from "@/lib/locale-context";

export function DataSaverToggle() {
  const { lowData, alwaysShowImages, toggleLowData, toggleAlwaysShowImages } = useDataSaver();
  const { dict } = useLocale();
  const router = useRouter();
  const panel = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const label = lowData ? dict.ui.disableLowDataMode : dict.ui.enableLowDataMode;

  useEffect(() => {
    const element = panel.current;
    if (!element) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !element.open) return;
      event.preventDefault();
      element.open = false;
      trigger.current?.focus();
    };
    element.addEventListener("keydown", closeOnEscape);
    return () => element.removeEventListener("keydown", closeOnEscape);
  }, []);

  function closePanel() {
    if (panel.current) panel.current.open = false;
    trigger.current?.focus();
  }

  return (
    <details ref={panel} className="group relative">
      <summary
        ref={trigger}
        aria-label={dict.ui.displayPreferences}
        aria-describedby="display-preferences-hint"
        data-testid="display-preferences"
        title={dict.ui.displayPreferences}
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-black/10 bg-white/70 text-sm transition hover:border-accent hover:bg-accent/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden dark:border-white/20 dark:bg-white/5"
      >
        <span aria-hidden="true">⚙</span>
      </summary>
      <div className="heritage-card absolute right-0 z-40 mt-2 grid w-64 gap-2 rounded-xl border p-3 text-sm shadow-xl">
        <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">{dict.ui.displayPreferences}</p>
        <p id="display-preferences-hint" className="sr-only">{dict.ui.displayPreferencesHint}</p>
        <button
          type="button"
          aria-label={alwaysShowImages ? dict.ui.useAutomaticImages : dict.ui.alwaysShowImages}
          aria-pressed={alwaysShowImages}
          onClick={() => {
            toggleAlwaysShowImages();
            closePanel();
          }}
          className={`rounded-lg border px-3 py-2 text-left transition ${alwaysShowImages ? "border-accent bg-accent/15 text-accent" : "border-black/10 hover:bg-accent/10 dark:border-white/20"}`}
        >
          {alwaysShowImages ? dict.ui.useAutomaticImages : dict.ui.alwaysShowImages}
        </button>
        <button
          type="button"
          aria-label={label}
          aria-pressed={lowData}
          onClick={() => {
            toggleLowData();
            closePanel();
            router.refresh();
          }}
          className={`rounded-lg border px-3 py-2 text-left transition ${lowData ? "border-accent bg-accent/15 text-accent" : "border-black/10 hover:bg-accent/10 dark:border-white/20"}`}
        >
          {label}
        </button>
      </div>
    </details>
  );
}
