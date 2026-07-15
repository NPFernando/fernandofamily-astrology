"use client";

import { useEffect, useState } from "react";
import { BIRD_ICONS } from "@/components/icons/birds";
import {
  loadAccountPreferences,
  saveAccountPreferences,
  type AccountPreferences,
} from "@/lib/account-preferences";
import { useLocale } from "@/lib/locale-context";
import { translateEnum } from "@/lib/i18n";
import { useTheme } from "@/lib/theme-context";
import type { BirdId } from "@/lib/api-client";
import {
  LocationPicker,
  type LocationValue,
} from "@/components/pancha-pakshi/LocationPicker";

const BIRDS: BirdId[] = ["vulture", "owl", "crow", "cock", "peacock"];

export function AccountDefaultsPanel() {
  const { dict, locale } = useLocale();
  const { theme } = useTheme();
  const [preferences, setPreferences] = useState<AccountPreferences | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAccountPreferences().then((result) => {
      if (cancelled) return;
      setPreferences(result.preferences);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: Parameters<typeof saveAccountPreferences>[0]) {
    setSaving(true);
    setStatus(null);
    const result = await saveAccountPreferences(patch);
    setSaving(false);
    if (!result.available) {
      setStatus(dict.ui.accountDefaultsError);
      return;
    }
    setPreferences(result.preferences);
    setStatus(dict.ui.accountDefaultsSaved);
    window.setTimeout(() => setStatus(null), 1800);
  }

  function saveBird(bird: BirdId | null) {
    void save({ default_bird: bird });
  }

  function saveLocation(loc: LocationValue) {
    void save({ default_location: loc });
  }

  function clearLocation() {
    void save({ default_location: null });
  }

  function resetDefaults() {
    void save({ locale: null, theme: null, default_bird: null, default_location: null });
  }

  const defaultBird = preferences?.default_bird ?? null;
  const defaultLocation = preferences?.default_location ?? null;

  return (
    <section
      className="mt-2 border-t border-black/10 pt-2 dark:border-white/15"
      aria-label={dict.ui.accountDefaults}
      data-testid="account-defaults-panel"
    >
      <div className="flex items-center justify-between gap-2 px-2">
        <h2 className="text-xs font-semibold uppercase opacity-70">{dict.ui.accountDefaults}</h2>
        <button
          type="button"
          onClick={resetDefaults}
          disabled={!loaded || saving}
          className="text-xs text-accent underline underline-offset-2 disabled:opacity-50"
        >
          {dict.ui.resetAccountDefaults}
        </button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 px-2 text-xs opacity-75">
        <span>
          {dict.ui.language}: {locale === "si" ? "සිංහල" : "English"}
        </span>
        <span>
          {dict.ui.theme}: {theme === "dark" ? dict.ui.darkMode : dict.ui.lightMode}
        </span>
      </div>

      <div className="mt-3 px-2">
        <p className="mb-1 text-xs font-medium opacity-70">{dict.ui.defaultBird}</p>
        <div className="flex flex-wrap gap-1.5">
          {BIRDS.map((bird) => {
            const Icon = BIRD_ICONS[bird];
            const selected = defaultBird === bird;
            return (
              <button
                key={bird}
                type="button"
                onClick={() => saveBird(bird)}
                disabled={!loaded || saving}
                aria-pressed={selected}
                aria-label={`${dict.ui.defaultBird}: ${translateEnum(dict, "birds", bird)}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-lg disabled:opacity-50 ${
                  selected
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-black/10 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                }`}
                title={translateEnum(dict, "birds", bird)}
              >
                <Icon />
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => saveBird(null)}
            disabled={!loaded || saving || !defaultBird}
            className="rounded-full border border-black/10 px-2 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {dict.ui.clearDefault}
          </button>
        </div>
      </div>

      <div className="mt-3 px-2">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-medium opacity-70">{dict.ui.defaultLocation}</p>
          {defaultLocation && (
            <button
              type="button"
              onClick={clearLocation}
              disabled={saving}
              className="text-xs text-accent underline underline-offset-2 disabled:opacity-50"
            >
              {dict.ui.clearDefault}
            </button>
          )}
        </div>
        {loaded ? (
          <LocationPicker value={defaultLocation} onChange={saveLocation} />
        ) : (
          <p className="text-xs opacity-70">{dict.ui.loading}</p>
        )}
      </div>

      {status && <p className="mt-2 px-2 text-xs opacity-75">{status}</p>}
    </section>
  );
}
