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
