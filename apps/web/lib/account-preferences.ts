"use client";

import type { BirdId } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";
import type { LocationValue } from "@/components/pancha-pakshi/LocationPicker";

export type AccountTheme = "light" | "dark";

export type AccountPreferences = {
  locale: Locale | null;
  theme: AccountTheme | null;
  default_bird: BirdId | null;
  default_location: LocationValue | null;
  updated_at?: string;
};

export type AccountPreferencePatch = Partial<{
  locale: Locale | null;
  theme: AccountTheme | null;
  default_bird: BirdId | null;
  default_location: LocationValue | null;
}>;

export type AccountPreferenceResult =
  | { available: true; preferences: AccountPreferences | null }
  | { available: false; preferences: null };

function normalizePreferences(raw: unknown): AccountPreferences | null {
  if (!raw || typeof raw !== "object") return null;
  const prefs = raw as Record<string, unknown>;
  return {
    locale: prefs.locale === "en" || prefs.locale === "si" ? prefs.locale : null,
    theme: prefs.theme === "light" || prefs.theme === "dark" ? prefs.theme : null,
    default_bird:
      prefs.default_bird === "vulture" ||
      prefs.default_bird === "owl" ||
      prefs.default_bird === "crow" ||
      prefs.default_bird === "cock" ||
      prefs.default_bird === "peacock"
        ? prefs.default_bird
        : null,
    default_location: normalizeLocation(prefs.default_location),
    updated_at: typeof prefs.updated_at === "string" ? prefs.updated_at : undefined,
  };
}

function normalizeLocation(raw: unknown): LocationValue | null {
  if (!raw || typeof raw !== "object") return null;
  const loc = raw as Record<string, unknown>;
  const name = typeof loc.name === "string" ? loc.name : "";
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  const ianaTz = typeof loc.iana_tz === "string" ? loc.iana_tz : "";
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || !ianaTz) return null;
  return { name, latitude, longitude, iana_tz: ianaTz };
}

export async function loadAccountPreferences(): Promise<AccountPreferenceResult> {
  try {
    const res = await fetch("/api/account/preferences", { cache: "no-store" });
    if (res.status === 401 || res.status === 404) return { available: false, preferences: null };
    if (!res.ok) return { available: false, preferences: null };
    const data = await res.json();
    return { available: true, preferences: normalizePreferences(data.preferences) };
  } catch {
    return { available: false, preferences: null };
  }
}

export async function saveAccountPreferences(
  patch: AccountPreferencePatch,
): Promise<AccountPreferenceResult> {
  try {
    const res = await fetch("/api/account/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.status === 401 || res.status === 404) return { available: false, preferences: null };
    if (!res.ok) return { available: false, preferences: null };
    const data = await res.json();
    return { available: true, preferences: normalizePreferences(data.preferences) };
  } catch {
    return { available: false, preferences: null };
  }
}
