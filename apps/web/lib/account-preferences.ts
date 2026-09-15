"use client";

import type { BirdId } from "@/lib/api-client";
import type { Locale } from "@/lib/i18n";
import type { LocationValue } from "@/components/pancha-pakshi/LocationPicker";

export type AccountTheme = "light" | "dark";

export type AccountPreferences = {
  locale: Locale | null;
  theme: AccountTheme | null;
  default_bird: BirdId | null;
  updated_at?: string;
};

export type AccountPreferencePatch = Partial<{
  locale: Locale | null;
  theme: AccountTheme | null;
  default_bird: BirdId | null;
}>;

export type AccountPreferenceResult =
  | { available: true; preferences: AccountPreferences | null }
  | { available: false; preferences: null };

/** Read only the migration bit; this endpoint does not return the location itself. */
export async function hasLegacyAccountLocationPending(): Promise<boolean> {
  try {
    const response = await fetch("/api/account/preferences", { cache: "no-store" });
    if (response.status === 401 || response.status === 404) return false;
    if (!response.ok) return true;
    const data = (await response.json()) as { legacy_location_pending?: unknown };
    return typeof data.legacy_location_pending === "boolean"
      ? data.legacy_location_pending
      : true;
  } catch {
    // Unknown is not equivalent to migrated: keep the privacy warning visible.
    return true;
  }
}

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

export type LegacyAccountLocationResult = {
  available: boolean;
  location: LocationValue | null;
  pending: boolean;
  revision?: string | null;
  invalidLegacyLocation?: boolean;
};

/** Only called while the user is unlocking the private vault. */
export async function loadLegacyAccountLocationForVaultMigration(): Promise<LegacyAccountLocationResult> {
  try {
    const response = await fetch("/api/account/preferences/migrate-location", { cache: "no-store" });
    // A signed-out browser has no account row to migrate. Other failures are
    // unknown state: keep the warning visible instead of declaring migration
    // complete when the server may still retain a precise location.
    if (response.status === 401) return { available: false, location: null, pending: false };
    if (!response.ok) return { available: false, location: null, pending: true };
    const data = (await response.json()) as {
      location?: unknown;
      revision?: unknown;
      invalid_legacy_location?: unknown;
      pending?: unknown;
    };
    const location = normalizeLocation(data.location);
    const invalidLegacyLocation = data.invalid_legacy_location === true;
    return {
      available: true,
      location,
      pending: typeof data.pending === "boolean"
        ? data.pending
        : Boolean(location || invalidLegacyLocation),
      revision: typeof data.revision === "string" ? data.revision : null,
      invalidLegacyLocation,
    };
  } catch {
    return { available: false, location: null, pending: true };
  }
}

/** Clear a legacy synced location only if it still matches the value encrypted locally. */
export async function clearMigratedLegacyAccountLocation(
  revision: string,
): Promise<boolean> {
  try {
    const response = await fetch("/api/account/preferences/migrate-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { cleared?: unknown };
    return result.cleared === true;
  } catch {
    return false;
  }
}

/** Explicitly discard only a malformed/unsupported legacy location for this account. */
export async function discardInvalidLegacyAccountLocation(
  revision: string,
): Promise<boolean> {
  try {
    const response = await fetch("/api/account/preferences/migrate-location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revision, discard_invalid: true }),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { cleared?: unknown };
    return result.cleared === true;
  } catch {
    return false;
  }
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
