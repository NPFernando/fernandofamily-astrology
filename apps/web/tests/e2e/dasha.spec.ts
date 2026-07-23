import { test, expect, type Page } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

// Same fixture birth as apps/api/tests/test_dasha.py's COLOMBO_BIRTH — first
// Mahadasha lord ("rahu") confirmed against the live API before writing this
// spec, so the assertion below is a real cross-check, not an invented value.
const SAMPLE = { date: "2000-01-01", time: "12:00" };

async function calculateDasha(page: Page, locale: LocaleKey) {
  const dict = DICTS[locale];
  await page.goto(`/${locale}/dasha`);
  await expect(page.locator('[data-testid="dasha-controls"]')).toBeVisible();
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: dict.dasha.calculate }).click();
  await expect(page.locator('[data-testid="dasha-result"]')).toBeVisible({ timeout: 20_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`dasha (${locale}): 9 Mahadashas render with Rahu first, without URL leakage`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    const dict = DICTS[locale];
    await calculateDasha(page, locale);

    const periods = page.locator('[data-testid="dasha-period"]');
    await expect(periods).toHaveCount(9);
    await expect(periods.first()).toContainText(dict.enums.horaPlanets.rahu);
    watcher.assertClean();
  });

  test(`dasha (${locale}): expanding a Mahadasha reveals its 9 Antardashas`, async ({ page }) => {
    const dict = DICTS[locale];
    await calculateDasha(page, locale);
    const firstPeriod = page.locator('[data-testid="dasha-period"]').first();
    await firstPeriod.locator("button").click();
    const antardashas = page.locator('[data-testid="dasha-antardasha"]');
    await expect(antardashas).toHaveCount(9);
    // The first Antardasha lord within a Mahadasha is always that same lord
    // (self-period first, per the Vimshottari sequencing rule).
    await expect(antardashas.first()).toContainText(dict.enums.horaPlanets.rahu);
  });
}

test("dasha: invalid location shows a validation error, not a crash", async ({ page }) => {
  const dict = DICTS.en;
  await page.goto("/en/dasha");
  await expect(page.locator('[data-testid="dasha-controls"]')).toBeVisible();
  await page.getByRole("button", { name: dict.ui.changeLocation }).click();
  await page.getByRole("tab", { name: dict.ui.manualEntry }).click();
  await page.getByPlaceholder(dict.ui.latitude).fill("999");
  await page.getByPlaceholder(dict.ui.longitude).fill("79.8612");
  await page.getByPlaceholder(dict.ui.timezone).fill("Asia/Colombo");
  await page.getByRole("button", { name: dict.ui.confirm }).first().click();
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: dict.dasha.calculate }).click();
  await expect(page.locator("#location-manual-status")).toBeVisible();
});
