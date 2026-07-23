// Everything this platform stores client-side: language, theme, last-selected
// bird, recent locations, recent birth date/time entries (2026-07-21 — a
// considered exception to this list's earlier "never birth date/time" rule,
// added for the birth-data calculators' repeat-use convenience; same
// device-local/never-sent-anywhere/user-clearable footing as everything
// else here), family almanac profile selection, and the last successfully
// cached schedule (for PWA offline display). Precise coordinates are still
// never stored beyond what's needed to redisplay a cached location shortcut.
const PREFERENCE_KEYS = [
  "ff_locale",
  "ff_theme",
  "ff_selected_bird",
  "ff_recent_locations",
  "ff_recent_birth_details",
  "ff_last_schedule_cache",
  "ff_saved_profiles",
  "ff_family_almanac_selected_profile_ids",
] as const;

export function clearSavedPreferences() {
  for (const key of PREFERENCE_KEYS) {
    window.localStorage.removeItem(key);
  }
  // Same-tab-session mirror of the last computed schedule (see
  // apps/web/app/[locale]/pancha-pakshi/page.tsx) — sessionStorage, not
  // localStorage, but still cleared here for a thorough "forget everything".
  window.sessionStorage.removeItem("ff_session_schedule");
  document.cookie = "ff_locale=; path=/; max-age=0";
}
