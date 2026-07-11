// Everything this platform stores client-side: language, theme, last-selected
// bird, recent locations, and the last successfully cached schedule (for PWA
// offline display). Never birth date/time or precise coordinates tied to a
// person, beyond what's needed to redisplay a cached location shortcut.
const PREFERENCE_KEYS = [
  "ff_locale",
  "ff_theme",
  "ff_selected_bird",
  "ff_recent_locations",
  "ff_last_schedule_cache",
] as const;

export function clearSavedPreferences() {
  for (const key of PREFERENCE_KEYS) {
    window.localStorage.removeItem(key);
  }
  document.cookie = "ff_locale=; path=/; max-age=0";
}
