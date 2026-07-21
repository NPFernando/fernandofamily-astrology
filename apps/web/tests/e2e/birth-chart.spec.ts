import { test, expect, type Page } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

// Same fixture birth as apps/api/tests/test_birth_chart.py's COLOMBO_BIRTH —
// ascendant rashi ("meena"/Pisces) confirmed against the live API before
// writing this spec.
const SAMPLE = { date: "2000-01-01", time: "12:00" };

async function calculateBirthChart(page: Page, locale: LocaleKey) {
  const dict = DICTS[locale];
  await page.goto(`/${locale}/birth-chart`);
  await expect(page.locator('[data-testid="birth-chart-controls"]')).toBeVisible();
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: dict.birthChart.calculate }).click();
  await expect(page.locator('[data-testid="birth-chart-result"]')).toBeVisible({ timeout: 20_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`birth chart (${locale}): Ascendant lands in Meena/Pisces, without URL leakage`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    const dict = DICTS[locale];
    await calculateBirthChart(page, locale);

    await expect(page.locator('[data-testid="rasi-cell-meena"]')).toContainText(dict.birthChart.ascendant);
    watcher.assertClean();
  });

  test(`birth chart (${locale}): toggling junction stars shows the Chitra/Spica overlay`, async ({ page }) => {
    await calculateBirthChart(page, locale);
    await page.locator('[data-testid="yogatara-toggle"]').click();
    await expect(page.locator('[data-testid="rasi-overlay-chitra"]')).toBeVisible();
    await expect(page.locator('[data-testid="rasi-overlay-chitra"]')).toContainText("Spica");
  });
}

test("birth chart: invalid location shows a validation error, not a crash", async ({ page }) => {
  const dict = DICTS.en;
  await page.goto("/en/birth-chart");
  await expect(page.locator('[data-testid="birth-chart-controls"]')).toBeVisible();
  await page.getByRole("button", { name: dict.ui.changeLocation }).click();
  await page.getByRole("tab", { name: dict.ui.manualEntry }).click();
  await page.getByPlaceholder(dict.ui.latitude).fill("999");
  await page.getByPlaceholder(dict.ui.longitude).fill("79.8612");
  await page.getByPlaceholder(dict.ui.timezone).fill("Asia/Colombo");
  await page.getByRole("button", { name: dict.ui.confirm }).first().click();
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: dict.birthChart.calculate }).click();
  await expect(page.locator("#location-manual-status")).toBeVisible();
});
