// Non-sensitive preferences stored outside the passphrase-protected vault.
// Birth details, precise locations, and schedule cache live only in the
// encrypted vault and are cleared through LocalVaultProvider.clear().
const PREFERENCE_KEYS = [
  "ff_locale",
  "ff_theme",
  "ff_saved_profiles",
  "ff_family_almanac_selected_profile_ids",
] as const;

export function clearSavedPreferences() {
  for (const key of PREFERENCE_KEYS) {
    window.localStorage.removeItem(key);
  }
  document.cookie = "ff_locale=; path=/; max-age=0";
}
