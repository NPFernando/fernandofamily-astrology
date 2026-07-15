// Pure, dependency-free so it's directly checkable by
// scripts/check-account-location-rounding.mjs (same lightweight-load
// pattern as lib/ics.ts) — do not add imports here.

export type NormalizedAccountLocation = {
  name: string;
  latitude: number;
  longitude: number;
  iana_tz: string;
};

// Rounds to 2 decimals (~1km) before storage, server-side — the client's
// precision is never trusted — matching the same privacy bound already
// enforced for push_subscriptions (lib/push-api.ts). A "default location"
// persisted to the account is exactly the kind of long-lived server record
// that bound applies to; plenty accurate for resolving sunrise/nakshatra/tithi.
export function normalizeAccountLocation(value: unknown): NormalizedAccountLocation | "invalid" | null {
  if (value === null) return null;
  if (typeof value !== "object") return "invalid";
  const loc = value as Record<string, unknown>;
  const name = typeof loc.name === "string" ? loc.name.trim() : "";
  const rawLatitude = Number(loc.latitude);
  const rawLongitude = Number(loc.longitude);
  const ianaTz = typeof loc.iana_tz === "string" ? loc.iana_tz.trim() : "";
  if (!name || name.length > 120) return "invalid";
  if (!Number.isFinite(rawLatitude) || rawLatitude < -90 || rawLatitude > 90) return "invalid";
  if (!Number.isFinite(rawLongitude) || rawLongitude < -180 || rawLongitude > 180) return "invalid";
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: ianaTz });
  } catch {
    return "invalid";
  }
  const latitude = Math.round(rawLatitude * 100) / 100;
  const longitude = Math.round(rawLongitude * 100) / 100;
  return { name, latitude, longitude, iana_tz: ianaTz };
}
