import { test, expect } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function waitForMuhurta(page: import("@playwright/test").Page) {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    if (await page.locator('[data-testid="muhurta-result"]').isVisible().catch(() => false)) return;
    const retry = page.getByRole("button", { name: DICTS.en.ui.retry, exact: true }).first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  await expect(page.locator('[data-testid="muhurta-result"]')).toBeVisible();
}

async function openMuhurta(page: import("@playwright/test").Page, locale: LocaleKey) {
  await page.goto(`/${locale}/muhurta`);
  await waitForMuhurta(page);
}

async function seedFamilyProfiles(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "ff_saved_profiles",
      JSON.stringify([
        {
          id: "family-amma",
          label: "Amma",
          bird: "peacock",
          nakshatra_index: null,
          paksha: null,
          moon_rashi_index: null,
          created_at: "2026-07-17T00:00:00.000Z",
        },
        {
          id: "family-thaththa",
          label: "Thaththa",
          bird: "owl",
          nakshatra_index: null,
          paksha: null,
          moon_rashi_index: null,
          created_at: "2026-07-17T00:00:00.000Z",
        },
      ]),
    );
  });
}

for (const locale of ["en", "si"] as const) {
  test(`muhurta (${locale}): zero-click render shows recommendations`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await openMuhurta(page, locale);
    await expect(page.locator('[data-testid="muhurta-controls"]')).toBeVisible();
    await expect(page.locator('[data-testid="muhurta-day-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="muhurta-windows"]')).toBeVisible();
    await expect(page.locator('[data-testid="muhurta-source-overlaps"]').first()).toBeVisible();
    await expect(page.getByText(DICTS[locale].muhurta.sourceOverlapsTitle).first()).toBeVisible();
    watcher.assertClean();
  });
}

test("muhurta: travel purpose shows direction caution", async ({ page }) => {
  await openMuhurta(page, "en");
  await page.getByRole("button", { name: DICTS.en.muhurta.purposes.travel }).click();
  await expect(page.getByText(DICTS.en.muhurta.cautions.disha_shool).first()).toBeVisible({ timeout: 20_000 });
});

test("@mobile muhurta keeps layout within 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openMuhurta(page, "si");
  await expect(page.locator('[data-testid="muhurta-family-panel"]')).toBeVisible();
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 5);
  expect(hasHScroll).toBe(false);
});

test("muhurta: family comparison uses saved profiles without URL data leaks", async ({ page }) => {
  await seedFamilyProfiles(page);
  const watcher = watchForBirthDataInUrls(page);
  await openMuhurta(page, "en");

  const panel = page.locator('[data-testid="muhurta-family-panel"]');
  await expect(panel).toContainText(DICTS.en.muhurta.familyTitle);
  await expect(panel.getByTestId("muhurta-family-profile")).toHaveCount(2);
  await expect(panel.getByTestId("muhurta-family-compare")).toBeEnabled();
  await panel.getByTestId("muhurta-family-compare").click();
  await expect(
    panel.locator('[data-testid="muhurta-family-shared-window"], [data-testid="muhurta-family-individual-window"]').first(),
  ).toBeVisible({ timeout: 30_000 });

  watcher.assertClean();
});

test("muhurta: family comparison shows an empty saved-profile state", async ({ page }) => {
  await openMuhurta(page, "en");
  const panel = page.locator('[data-testid="muhurta-family-panel"]');
  await expect(panel).toContainText(DICTS.en.muhurta.familyEmptyTitle);
  await expect(panel.getByRole("link", { name: DICTS.en.muhurta.familyCreateProfile })).toHaveAttribute(
    "href",
    "/en/birth-nakshatra",
  );
});

test("muhurta: landing card, nav link, and sitemap are present", async ({ page, request }) => {
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(DICTS.en.features.muhurta.title) }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: DICTS.en.nav.muhurta }).first().click();
  await expect(page).toHaveURL(/\/en\/muhurta$/);
  await waitForMuhurta(page);

  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/muhurta");
  expect(body).toContain("/si/muhurta");
});
