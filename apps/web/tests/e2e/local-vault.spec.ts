import { expect, test, type Page } from "@playwright/test";

const PASSPHRASE = "correct horse battery staple";
const BIRTH_DATE = "2000-01-01";
const BIRTH_TIME = "12:00";
const LOCATION = {
  name: "Colombo, Sri Lanka",
  latitude: 6.9271,
  longitude: 79.8612,
  iana_tz: "Asia/Colombo",
};

const LEGACY_KEYS = [
  "ff_recent_birth_details",
  "ff_recent_locations",
  "ff_last_schedule_cache",
  "ff_session_schedule",
  "ff_live_schedule_seed",
  "ff_derived_identity_seed",
] as const;

async function createVault(page: Page, passphrase = PASSPHRASE) {
  await page.getByRole("button", { name: "Protect private data" }).click();
  await page.getByLabel("Choose a vault passphrase").fill(passphrase);
  await page.getByRole("button", { name: "Create vault" }).click();
  await expect(page.locator('[title="Private data vault unlocked for this tab"]')).toBeVisible();
}

test("local vault migrates sensitive legacy values, restores them after unlock, and clears them", async ({ page }) => {
  await page.goto("/en/birth-chart");
  const legacyValues = [
    ["local", "ff_recent_birth_details", `[{"birth_date":"${BIRTH_DATE}","birth_time":"${BIRTH_TIME}"}]`],
    ["local", "ff_recent_locations", JSON.stringify([LOCATION])],
    ["local", "ff_last_schedule_cache", JSON.stringify({ schedule: { location: LOCATION, birth_bird: "peacock" }, cachedAtIso: "2026-08-05T00:00:00.000Z" })],
    ["session", "ff_session_schedule", JSON.stringify({ schedule: { location: LOCATION }, serverTimeIso: null, fetchedAtClientMs: 1 })],
    ["session", "ff_live_schedule_seed", JSON.stringify({ schedule: { location: LOCATION }, request: { latitude: LOCATION.latitude, longitude: LOCATION.longitude }, serverTimeIso: null, fetchedAtClientMs: 1 })],
    ["session", "ff_derived_identity_seed", JSON.stringify({ bird: "peacock", nakshatra_index: null, paksha: null, moon_rashi_index: null, savedAtIso: "2026-08-05T00:00:00.000Z" })],
  ] as const;
  await page.evaluate((entries) => {
    for (const [scope, key, value] of entries) {
      (scope === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
    }
  }, legacyValues);

  await createVault(page);
  const migrated = await page.evaluate((keys) => ({
    vault: window.localStorage.getItem("ff_private_vault_v1"),
    salt: window.localStorage.getItem("ff_private_vault_salt_v1"),
    local: keys.slice(0, 3).map((key) => window.localStorage.getItem(key)),
    session: keys.slice(3).map((key) => window.sessionStorage.getItem(key)),
  }), [...LEGACY_KEYS]);
  expect(migrated.vault).toContain("ciphertext");
  expect(migrated.salt).toBeTruthy();
  expect(migrated.vault).not.toContain(BIRTH_DATE);
  expect(migrated.vault).not.toContain(String(LOCATION.latitude));
  expect(migrated.local).toEqual([null, null, null]);
  expect(migrated.session).toEqual([null, null, null]);

  await page.reload();
  await page.getByRole("button", { name: "Unlock private data" }).click();
  await page.getByLabel("Vault passphrase").fill("wrong passphrase");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByText("That passphrase could not unlock this vault.", { exact: true })).toBeVisible();

  await page.getByLabel("Vault passphrase").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE);
  await expect(page.locator('input[type="time"]')).toHaveValue(BIRTH_TIME);

  await page.goto("/en/privacy");
  await page.getByRole("button", { name: "Clear saved preferences" }).click();
  const cleared = await page.evaluate((keys) => ({
    vault: window.localStorage.getItem("ff_private_vault_v1"),
    salt: window.localStorage.getItem("ff_private_vault_salt_v1"),
    local: keys.slice(0, 3).map((key) => window.localStorage.getItem(key)),
    session: keys.slice(3).map((key) => window.sessionStorage.getItem(key)),
  }), [...LEGACY_KEYS]);
  expect(cleared.vault).toBeNull();
  expect(cleared.salt).toBeNull();
  expect(cleared.local).toEqual([null, null, null]);
  expect(cleared.session).toEqual([null, null, null]);
});
