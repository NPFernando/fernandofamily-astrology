// Recent birth date/time entries, device-local only — same footing as
// components/pancha-pakshi/LocationPicker.tsx's recent-locations (same
// ff_* key convention, same cap/dedup/most-recent-first shape, same
// explicit clear-data escape hatch). Until this module, birth date/time was
// deliberately never persisted anywhere (see lib/profiles.ts's SavedProfile
// comment) — this is a considered exception for the birth-data calculators
// (Birth Chart, Dasha, Divisional Charts, Porondam), where retyping the same
// birth details on every visit was real, repeat-use friction. Still fully
// consistent with the app's privacy posture: device-local, never sent
// anywhere new, user-clearable.

export type RecentBirthDetails = { birth_date: string; birth_time: string };

const RECENT_KEY = "ff_recent_birth_details";
const MAX_RECENT = 5;

function loadRecent(): RecentBirthDetails[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as RecentBirthDetails[]) : [];
  } catch {
    return [];
  }
}

export function mostRecentBirthDetails(): RecentBirthDetails | null {
  return loadRecent()[0] ?? null;
}

export function saveRecentBirthDetails(entry: RecentBirthDetails) {
  if (typeof window === "undefined") return;
  const existing = loadRecent().filter(
    (e) => !(e.birth_date === entry.birth_date && e.birth_time === entry.birth_time),
  );
  const next = [entry, ...existing].slice(0, MAX_RECENT);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function clearRecentBirthDetails() {
  window.localStorage.removeItem(RECENT_KEY);
}
