import { expect, test, type Page } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function waitForFamilyAlmanac(page: Page) {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    if (await page.locator('[data-testid="family-almanac-result"]').isVisible().catch(() => false)) return;
    const retry = page.getByRole("button", { name: DICTS.en.ui.retry, exact: true }).first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  await expect(page.locator('[data-testid="family-almanac-result"]')).toBeVisible();
}

async function openFamilyAlmanac(page: Page, locale: LocaleKey, query = "") {
  await page.goto(`/${locale}/family-almanac${query}`);
  await waitForFamilyAlmanac(page);
}

async function seedFamilyProfiles(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "ff_saved_profiles",
      JSON.stringify([
        {
          id: "almanac-amma",
          label: "Amma",
          bird: null,
          nakshatra_index: 5,
          paksha: "waxing",
          moon_rashi_index: 7,
          created_at: "2026-07-17T00:00:00.000Z",
        },
        {
          id: "almanac-thaththa",
          label: "Thaththa",
          bird: "owl",
          nakshatra_index: null,
          paksha: null,
          moon_rashi_index: null,
          created_at: "2026-07-17T00:01:00.000Z",
        },
        {
          id: "almanac-duwa",
          label: "Duwa",
          bird: "peacock",
          nakshatra_index: null,
          paksha: null,
          moon_rashi_index: null,
          created_at: "2026-07-17T00:02:00.000Z",
        },
      ]),
    );
  });
}

for (const locale of ["en", "si"] as const) {
  test(`family almanac (${locale}): empty profile state still renders daily context`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await openFamilyAlmanac(page, locale);
    await expect(page.locator('[data-testid="family-almanac-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="family-almanac-timing-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="family-almanac-empty-profiles"]').first()).toContainText(
      DICTS[locale].familyAlmanac.emptyTitle,
    );
    await expect(page.getByRole("link", { name: DICTS[locale].familyAlmanac.createProfile }).first()).toHaveAttribute(
      "href",
      `/${locale}/birth-nakshatra`,
    );
    watcher.assertClean();
  });
}

test("family almanac: seeded profiles render today cards and seven-day planner without URL leaks", async ({ page }) => {
  await seedFamilyProfiles(page);
  const watcher = watchForBirthDataInUrls(page);
  await openFamilyAlmanac(page, "en", "?date=2026-07-23");

  await expect(page.locator('[data-testid="family-almanac-profile"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="family-almanac-profile-cards"]')).toContainText("Amma", {
    timeout: 45_000,
  });
  await expect(page.locator('[data-testid="family-almanac-person-card"]')).toHaveCount(3);
  await expect(page.locator('[data-testid="family-almanac-person-card"]').first()).toContainText(
    DICTS.en.familyAlmanac.bestIndividualWindow,
  );
  await expect(page.locator('[data-testid="family-almanac-week-day"]')).toHaveCount(7);
  await expect(
    page
      .locator('[data-testid="family-almanac-shared-window"], [data-testid="family-almanac-individual-window"]')
      .first(),
  ).toBeVisible({ timeout: 60_000 });

  const storage = await page.evaluate(() => window.localStorage.getItem("ff_saved_profiles") ?? "");
  expect(storage).not.toContain("birth_date");
  expect(storage).not.toContain("birth_time");
  watcher.assertClean();
});

test("family almanac: quick bird profile creation and selected profiles persist locally", async ({ page }) => {
  await openFamilyAlmanac(page, "en", "?date=2026-07-23");
  const form = page.getByTestId("family-almanac-quick-profile");
  await form.getByPlaceholder(DICTS.en.familyAlmanac.quickProfileLabel).fill("Aiya");
  await form.locator("select").selectOption("owl");
  await form.getByRole("button", { name: DICTS.en.familyAlmanac.addDirectBirdProfile }).click();

  await expect(page.locator('[data-testid="family-almanac-profile"]').filter({ hasText: "Aiya" })).toBeVisible();
  const selected = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("ff_family_almanac_selected_profile_ids") ?? "[]"),
  );
  expect(selected).toHaveLength(1);

  await page.reload();
  await waitForFamilyAlmanac(page);
  await expect(page.locator('[data-testid="family-almanac-profile"]').filter({ hasText: "Aiya" })).toBeVisible();
  await expect(page.locator('[data-testid="family-almanac-profile"]').filter({ hasText: "Aiya" }).getByRole("button").first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const storage = await page.evaluate(() => window.localStorage.getItem("ff_saved_profiles") ?? "");
  expect(storage).not.toContain("birth_date");
  expect(storage).not.toContain("birth_time");
});

test("family almanac: saved profiles can be renamed and removed", async ({ page }) => {
  await seedFamilyProfiles(page);
  await openFamilyAlmanac(page, "en", "?date=2026-07-23");

  const amma = page.locator('[data-testid="family-almanac-profile"]').filter({ hasText: "Amma" });
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(DICTS.en.familyAlmanac.renameProfilePrompt);
    await dialog.accept("Ammi");
  });
  await amma.getByRole("button", { name: DICTS.en.familyAlmanac.renameProfile }).click();
  await expect(page.locator('[data-testid="family-almanac-profile"]').filter({ hasText: "Ammi" })).toBeVisible();

  await page
    .locator('[data-testid="family-almanac-profile"]')
    .filter({ hasText: "Duwa" })
    .getByRole("button", { name: DICTS.en.familyAlmanac.deleteProfile })
    .click();
  await expect(page.locator('[data-testid="family-almanac-profile"]').filter({ hasText: "Duwa" })).toHaveCount(0);
});

test("family almanac: planner export and share action avoid raw birth fields", async ({ page }) => {
  await seedFamilyProfiles(page);
  const watcher = watchForBirthDataInUrls(page);
  let sharePayload: unknown = null;
  await page.route("**/api/share-family-card", async (route) => {
    sharePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
      ]),
    });
  });
  await openFamilyAlmanac(page, "en", "?date=2026-07-23");
  await expect(page.getByTestId("family-almanac-download-ics")).toBeEnabled({ timeout: 60_000 });

  const [icsDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("family-almanac-download-ics").click(),
  ]);
  expect(icsDownload.suggestedFilename()).toBe("family-almanac-2026-07-23.ics");

  const [pngDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("family-almanac-share-image").click(),
  ]);
  expect(pngDownload.suggestedFilename()).toBe("family-almanac-2026-07-23.png");
  expect(JSON.stringify(sharePayload)).not.toContain("birth_date");
  expect(JSON.stringify(sharePayload)).not.toContain("birth_time");
  expect(JSON.stringify(sharePayload)).not.toContain("birth_latitude");
  expect(JSON.stringify(sharePayload)).not.toContain("birth_longitude");
  watcher.assertClean();
});

test("family almanac: Poya date query opens the requested Poya context", async ({ page }) => {
  await seedFamilyProfiles(page);
  await openFamilyAlmanac(page, "en", "?date=2026-07-29");
  await expect(page.locator('[data-testid="family-almanac-poya-badge"]')).toContainText(
    DICTS.en.panchanga.poyaTodayLabel,
    { timeout: 30_000 },
  );
  await expect(page.locator('[data-testid="family-almanac-poya-detail"]')).toContainText(
    DICTS.en.enums.sinhalaMonths.esala,
  );
});

test("family almanac: landing card, nav link, and sitemap are present", async ({ page, request }) => {
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(DICTS.en.features.familyAlmanac.title) }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: DICTS.en.nav.familyAlmanac }).first().click();
  await expect(page).toHaveURL(/\/en\/family-almanac$/);
  await waitForFamilyAlmanac(page);

  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/family-almanac");
  expect(body).toContain("/si/family-almanac");
});

test("@mobile family almanac keeps Sinhala layout within 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seedFamilyProfiles(page);
  await openFamilyAlmanac(page, "si", "?date=2026-07-23");
  await expect(page.locator('[data-testid="family-almanac-profile-cards"]')).toBeVisible();
  await expect(page.locator('[data-testid="family-almanac-week-day"]').first()).toBeVisible({ timeout: 60_000 });
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 5);
  expect(hasHScroll).toBe(false);
});

test("share-family-card route returns PNG and rejects raw birth fields", async ({ request }) => {
  const body = {
    locale: "si",
    date: "2026-07-23",
    location: {
      name: "Colombo",
      latitude: 6.9271,
      longitude: 79.8612,
      iana_tz: "Asia/Colombo",
    },
    profiles: [
      {
        label: "Amma",
        bird: "peacock",
        nakshatra_index: null,
        paksha: null,
        moon_rashi_index: null,
      },
    ],
  };

  const res = await request.post("/api/share-family-card", { data: body });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  const png = await res.body();
  expect(png.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  expect(png.length).toBeGreaterThan(10_000);

  const bad = await request.post("/api/share-family-card", {
    data: { ...body, profiles: [{ ...body.profiles[0], birth_date: "1990-01-01" }] },
  });
  expect(bad.status()).toBe(422);
});
