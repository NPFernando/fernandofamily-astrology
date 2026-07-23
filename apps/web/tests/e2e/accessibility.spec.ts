import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { DICTS } from "./helpers";

// Smoke-level a11y guardrail, not exhaustive coverage: runs an axe-core scan
// against a representative set of already-rendered pages/states (home, a
// calculated birth chart with its sr-only accessible table, a moon-calendar
// month with a Poya day selected, a dasha timeline with a period expanded,
// and the daily panchanga) in both locales, asserting zero critical/serious
// violations. This catches regressions in the fixes from the 2026-07-20
// accessibility pass; it does not replace a full manual/AT audit.
const SEVERE = ["critical", "serious"];

function assertNoSevereViolations(violations: { id: string; impact?: string | null; nodes: unknown[] }[]) {
  const severe = violations.filter((v) => v.impact && SEVERE.includes(v.impact));
  expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
}

for (const locale of ["en", "si"] as const) {
  test(`a11y (${locale}): home page has no critical/serious violations`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSevereViolations(results.violations);
  });

  test(`a11y (${locale}): birth chart (calculated, star overlay on) has no critical/serious violations`, async ({
    page,
  }) => {
    const dict = DICTS[locale];
    await page.goto(`/${locale}/birth-chart`);
    await page.locator('input[type="date"]').fill("2000-01-01");
    await page.locator('input[type="time"]').fill("12:00");
    await page.getByRole("button", { name: dict.birthChart.calculate }).click();
    await expect(page.locator('[data-testid="birth-chart-result"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid="yogatara-toggle"]').click();
    await expect(page.locator('[data-testid="rasi-overlay-chitra"]')).toBeVisible({ timeout: 10_000 });
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSevereViolations(results.violations);
  });

  test(`a11y (${locale}): daily panchanga has no critical/serious violations`, async ({ page }) => {
    await page.goto(`/${locale}/panchanga`);
    await expect(page.locator('[data-testid="panchanga-result"]')).toBeVisible({ timeout: 20_000 });
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSevereViolations(results.violations);
  });

  test(`a11y (${locale}): family almanac has no critical/serious violations`, async ({ page }) => {
    await page.goto(`/${locale}/family-almanac`);
    await expect(page.locator('[data-testid="family-almanac-result"]')).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSevereViolations(results.violations);
  });

  test(`a11y (${locale}): moon calendar with a Poya day selected has no critical/serious violations`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/moon-calendar`);
    await expect(page.locator('[data-testid="moon-calendar-result"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid="moon-calendar-poya"]').first().click();
    await expect(page.locator('[data-testid="moon-calendar-selected-day"]')).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSevereViolations(results.violations);
  });

  test(`a11y (${locale}): dasha timeline with a period expanded has no critical/serious violations`, async ({
    page,
  }) => {
    const dict = DICTS[locale];
    await page.goto(`/${locale}/dasha`);
    await page.locator('input[type="date"]').fill("2000-01-01");
    await page.locator('input[type="time"]').fill("12:00");
    await page.getByRole("button", { name: dict.dasha.calculate }).click();
    await expect(page.locator('[data-testid="dasha-result"]')).toBeVisible({ timeout: 20_000 });
    await page.locator('[data-testid="dasha-period"] button').first().click();
    await expect(page.locator('[data-testid="dasha-antardasha"]').first()).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSevereViolations(results.violations);
  });

  test(`a11y (${locale}): horoscope report has no critical/serious violations`, async ({ page }) => {
    const dict = DICTS[locale];
    await page.goto(`/${locale}/horoscope-report`);
    await page.locator('input[type="date"]').fill("2000-01-01");
    await page.locator('input[type="time"]').fill("12:00");
    await page.getByRole("button", { name: dict.horoscopeReport.calculate }).click();
    await expect(page.locator('[data-testid="horoscope-report-result"]')).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).analyze();
    assertNoSevereViolations(results.violations);
  });
}
