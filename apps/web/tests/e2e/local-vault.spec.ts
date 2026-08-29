import { expect, test, type Page } from "@playwright/test";
import { DICTS } from "./helpers";

const PASSPHRASE = "correct horse battery staple";
const BIRTH_DATE = "2000-01-01";
const BIRTH_TIME = "12:00";
const LOCATION = {
  name: "Private test location",
  latitude: 7.2906,
  longitude: 80.6337,
  iana_tz: "Asia/Colombo",
};

const LEGACY_KEYS = [
  "ff_recent_birth_details",
  "ff_recent_locations",
  "ff_last_schedule_cache",
  "ff_selected_bird",
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

async function readDownload(download: import("@playwright/test").Download): Promise<string> {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Vault backup download stream was unavailable.");
  let content = "";
  for await (const chunk of stream) content += chunk.toString();
  return content;
}

test("legacy private data receives a visible migration deadline before vault creation", async ({ page }) => {
  await page.goto("/en/birth-chart");
  await page.evaluate(() => {
    window.localStorage.setItem("ff_recent_birth_details", '[{"birth_date":"2000-01-01","birth_time":"12:00"}]');
  });
  await page.reload();

  await page.getByRole("button", { name: "Protect private data" }).click();
  await expect(page.getByText("Private data from an older version is waiting to be encrypted.", { exact: false })).toBeVisible();
  await expect(page.getByText("2027-02-01", { exact: false })).toBeVisible();
});

test("privacy page: private data center hides counts while the vault is locked", async ({ page }) => {
  await page.goto("/en/privacy");
  const center = page.locator('[data-testid="privacy-data-center"]');
  await expect(center).toBeVisible();
  await expect(center).toContainText(DICTS.en.ui.dataCenterEmpty);
  await expect(center).toContainText("—");
  await expect(center.getByRole("button", { name: DICTS.en.ui.dataCenterExportProfiles })).toBeVisible();
});

test("local vault migrates sensitive legacy values, restores them after unlock, and clears them", async ({ page }) => {
  await page.goto("/en/birth-chart");
  const legacyValues = [
    ["local", "ff_recent_birth_details", `[{"birth_date":"${BIRTH_DATE}","birth_time":"${BIRTH_TIME}"}]`],
    ["local", "ff_recent_locations", JSON.stringify([LOCATION])],
    ["local", "ff_last_schedule_cache", JSON.stringify({ schedule: { location: LOCATION, birth_bird: "peacock" }, cachedAtIso: "2026-08-05T00:00:00.000Z" })],
    ["local", "ff_selected_bird", "peacock"],
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
    local: keys.slice(0, 4).map((key) => window.localStorage.getItem(key)),
    session: keys.slice(4).map((key) => window.sessionStorage.getItem(key)),
  }), [...LEGACY_KEYS]);
  expect(migrated.vault).toContain("ciphertext");
  expect(migrated.salt).toBeTruthy();
  expect(migrated.vault).not.toContain(BIRTH_DATE);
  expect(migrated.vault).not.toContain(String(LOCATION.latitude));
  expect(migrated.local).toEqual([null, null, null, null]);
  expect(migrated.session).toEqual([null, null, null]);

  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE);
  await page.getByRole("button", { name: "Lock private data" }).click();
  await expect(page.getByRole("button", { name: "Unlock private data" })).toBeVisible();
  await expect(page.locator('input[type="date"]')).not.toHaveValue(BIRTH_DATE);
  await expect(page.getByText(LOCATION.name, { exact: true })).not.toBeVisible();

  // A new page shares browser storage but not this tab's in-memory key or
  // location cache. It must see only encrypted ciphertext and remain locked.
  const lockedTab = await page.context().newPage();
  await lockedTab.goto("/en/birth-chart");
  await expect(lockedTab.getByRole("button", { name: "Unlock private data" })).toBeVisible();
  await expect(lockedTab.getByText(LOCATION.name, { exact: true })).not.toBeVisible();
  const lockedStorage = await lockedTab.evaluate((keys) => ({
    local: keys.slice(0, 4).map((key) => window.localStorage.getItem(key)),
    session: keys.slice(4).map((key) => window.sessionStorage.getItem(key)),
  }), [...LEGACY_KEYS]);
  expect(lockedStorage.local).toEqual([null, null, null, null]);
  expect(lockedStorage.session).toEqual([null, null, null]);
  await lockedTab.close();

  await page.getByRole("button", { name: "Unlock private data" }).click();
  await page.getByLabel("Vault passphrase").fill("wrong passphrase");
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByText("That passphrase could not unlock this vault.", { exact: true })).toBeVisible();

  await page.getByLabel("Vault passphrase").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE);
  await expect(page.locator('input[type="time"]')).toHaveValue(BIRTH_TIME);

  await page.goto("/en/privacy");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Clear saved preferences" }).click();
  const cleared = await page.evaluate((keys) => ({
    vault: window.localStorage.getItem("ff_private_vault_v1"),
    salt: window.localStorage.getItem("ff_private_vault_salt_v1"),
    local: keys.slice(0, 4).map((key) => window.localStorage.getItem(key)),
    session: keys.slice(4).map((key) => window.sessionStorage.getItem(key)),
  }), [...LEGACY_KEYS]);
  expect(cleared.vault).toBeNull();
  expect(cleared.salt).toBeNull();
  expect(cleared.local).toEqual([null, null, null, null]);
  expect(cleared.session).toEqual([null, null, null]);
});

test("vault backup is ciphertext-only and restores only after the original passphrase is supplied", async ({ page, browser }) => {
  await page.goto("/en/birth-chart");
  await page.evaluate((location) => {
    window.localStorage.setItem(
      "ff_recent_birth_details",
      JSON.stringify([{ birth_date: "2000-01-01", birth_time: "12:00" }]),
    );
    window.localStorage.setItem("ff_recent_locations", JSON.stringify([location]));
  }, LOCATION);
  await createVault(page);
  await page.getByRole("link", { name: "Daily Guide", exact: true }).click();
  await page.getByRole("link", { name: "Open private planner", exact: true }).click();
  await page.getByLabel("Plan title").fill("Private temple reminder");
  await page.getByRole("button", { name: "Add to agenda" }).click();
  await expect(page.getByTestId("planner-agenda")).toContainText("Private temple reminder");
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.locator('[data-testid="vault-recovery-checklist"]')).toContainText("Recovery checklist");

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("vault-backup-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fernando-family-private-vault-v1.json");
  const backup = await readDownload(download);
  expect(backup).toContain('"format":"fernandofamily-private-vault"');
  expect(backup).toContain('"ciphertext"');
  expect(backup).not.toContain(BIRTH_DATE);
  expect(backup).not.toContain(String(LOCATION.latitude));
  expect(backup).not.toContain("Private temple reminder");

  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3199" });
  const restored = await context.newPage();
  await restored.goto("/en/privacy");
  await expect.poll(() => restored.evaluate(() => window.localStorage.getItem("ff_private_vault_v1"))).toBeNull();
  await restored.getByTestId("vault-backup-upload").setInputFiles({
    name: "fernando-family-private-vault-v1.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await expect(restored.getByText("Backup restored. Unlock the vault with its original passphrase.", { exact: true })).toBeVisible();
  await expect(restored.getByRole("button", { name: "Restore encrypted backup" })).toBeDisabled();

  await restored.goto("/en/birth-chart");
  await restored.getByRole("button", { name: "Unlock private data" }).click();
  await restored.getByLabel("Vault passphrase").fill(PASSPHRASE);
  await restored.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(restored.locator('input[type="date"]')).toHaveValue(BIRTH_DATE);
  await expect(restored.locator('input[type="time"]')).toHaveValue(BIRTH_TIME);
  await restored.getByRole("link", { name: "Daily Guide", exact: true }).click();
  await restored.getByRole("link", { name: "Open private planner", exact: true }).click();
  await expect(restored.getByTestId("planner-agenda")).toContainText("Private temple reminder");
  await context.close();
});

test("vault backup rejects invalid files without creating a vault", async ({ page }) => {
  await page.goto("/en/privacy");
  await page.getByTestId("vault-backup-upload").setInputFiles({
    name: "invalid-vault.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"format":"not-a-vault"}'),
  });
  await expect(page.getByText("This backup file is invalid or unsupported.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Protect private data" })).toBeVisible();
});

test("vault passphrase rotation re-encrypts data and invalidates the previous passphrase", async ({ page }) => {
  const newPassphrase = "new correct horse battery staple";
  await page.goto("/en/birth-chart");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "ff_recent_birth_details",
      JSON.stringify([{ birth_date: "2000-01-01", birth_time: "12:00" }]),
    );
  });
  await createVault(page);
  const before = await page.evaluate(() => ({
    salt: window.localStorage.getItem("ff_private_vault_salt_v1"),
    payload: window.localStorage.getItem("ff_private_vault_v1"),
  }));

  await page.goto("/en/privacy");
  await page.getByRole("button", { name: "Unlock private data" }).click();
  await page.getByLabel("Vault passphrase").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await page.getByLabel("New vault passphrase").fill(newPassphrase);
  await page.getByLabel("Confirm new passphrase").fill(newPassphrase);
  await page.getByRole("button", { name: "Change vault passphrase" }).click();
  await expect(page.getByText("Vault passphrase changed. Download a new encrypted backup.", { exact: true })).toBeVisible();
  const after = await page.evaluate(() => ({
    salt: window.localStorage.getItem("ff_private_vault_salt_v1"),
    payload: window.localStorage.getItem("ff_private_vault_v1"),
    rotation: window.localStorage.getItem("ff-vault-transaction"),
  }));
  expect(after.salt).not.toBe(before.salt);
  expect(after.payload).not.toBe(before.payload);
  expect(after.payload).not.toContain(BIRTH_DATE);
  expect(after.rotation).toBeNull();
  await expect(page.getByTestId("vault-backup-recommended")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("vault-backup-download").click();
  await downloadPromise;
  await expect(page.getByTestId("vault-backup-recommended")).not.toBeVisible();

  await page.getByRole("button", { name: "Lock private data" }).click();
  await page.getByRole("button", { name: "Unlock private data" }).click();
  await page.getByLabel("Vault passphrase").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.getByText("That passphrase could not unlock this vault.", { exact: true })).toBeVisible();

  await page.getByLabel("Vault passphrase").fill(newPassphrase);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await page.goto("/en/birth-chart");
  await page.getByRole("button", { name: "Unlock private data" }).click();
  await page.getByLabel("Vault passphrase").fill(newPassphrase);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE);
  await expect(page.locator('input[type="time"]')).toHaveValue(BIRTH_TIME);

  // Simulate a tab being interrupted between the new salt and new ciphertext
  // writes. The next page must recover the previous authenticated pair rather
  // than leave the vault unreadable.
  if (!before.salt || !before.payload || !after.salt || !after.payload) {
    throw new Error("Expected both vault storage pairs for rotation recovery test.");
  }
  await page.evaluate(({ previous, next }) => {
    window.localStorage.setItem("ff-vault-transaction", JSON.stringify({ version: 1, previous, next }));
    window.localStorage.setItem("ff_private_vault_salt_v1", next.salt);
    window.localStorage.setItem("ff_private_vault_v1", JSON.stringify(previous.payload));
  }, {
    previous: { salt: before.salt, payload: JSON.parse(before.payload) },
    next: { salt: after.salt, payload: JSON.parse(after.payload) },
  });
  await page.reload();
  await page.getByRole("button", { name: "Unlock private data" }).click();
  await page.getByLabel("Vault passphrase").fill(PASSPHRASE);
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  await expect(page.locator('input[type="date"]')).toHaveValue(BIRTH_DATE);
  await expect(page.locator('input[type="time"]')).toHaveValue(BIRTH_TIME);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("ff-vault-transaction"))).toBeNull();
});
