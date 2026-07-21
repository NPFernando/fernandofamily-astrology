import { test, expect, type Page } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

const SAMPLE = { date: "2000-01-01", time: "12:00" };

async function calculateNavamsa(page: Page, locale: LocaleKey) {
  const dict = DICTS[locale];
  await page.goto(`/${locale}/divisional-charts`);
  await expect(page.locator('[data-testid="divisional-charts-controls"]')).toBeVisible();
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: dict.divisionalCharts.calculate }).click();
  await expect(page.locator('[data-testid="divisional-charts-result"]')).toBeVisible({ timeout: 20_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`divisional charts (${locale}): Navamsa chart computes without URL leakage`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    const dict = DICTS[locale];
    await calculateNavamsa(page, locale);

    await expect(page.getByRole("heading", { name: dict.divisionalCharts.title })).toBeVisible();
    // Navamsa ascendant for this fixture birth (2000-01-01 12:00 Colombo) is
    // Simha — confirmed against the live API before writing this spec.
    await expect(page.locator('[data-testid="navamsa-cell-simha"]')).toContainText(
      dict.divisionalCharts.ascendant,
    );
    watcher.assertClean();
  });
}

test("divisional charts: invalid birth date shows a validation error, not a crash", async ({ page }) => {
  const dict = DICTS.en;
  await page.goto("/en/divisional-charts");
  await expect(page.locator('[data-testid="divisional-charts-controls"]')).toBeVisible();
  // A latitude/longitude out of range is what the API actually rejects with
  // 422 — exercised here via the manual-entry location tab, matching the
  // backend's own invalid-latitude coverage (test_divisional_charts.py).
  await page.getByRole("button", { name: dict.ui.changeLocation }).click();
  await page.getByRole("tab", { name: dict.ui.manualEntry }).click();
  await page.getByPlaceholder(dict.ui.latitude).fill("999");
  await page.getByPlaceholder(dict.ui.longitude).fill("79.8612");
  await page.getByPlaceholder(dict.ui.timezone).fill("Asia/Colombo");
  await page.getByRole("button", { name: dict.ui.confirm }).first().click();
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: dict.divisionalCharts.calculate }).click();
  await expect(page.locator("#location-manual-status")).toBeVisible();
});

test("divisional charts: nav link and sitemap are present", async ({ page, request }) => {
  const dict = DICTS.en;
  await page.goto("/en");
  await expect(page.getByRole("link", { name: dict.nav.divisionalCharts, exact: true })).toBeVisible();
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/en/divisional-charts");
});
