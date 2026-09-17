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

  test(`a11y (${locale}): open command palette has no critical/serious violations`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await page.keyboard.press("Control+K");
    const dialog = page.getByRole("dialog", { name: DICTS[locale].ui.commandPalette });
    await expect(dialog).toBeVisible();
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
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

test.describe("WCAG browser checks", () => {
  test("public routes have no WCAG 2A/2AA axe violations", async ({ page }) => {
    for (const route of ["/en", "/en/birth-chart", "/en/daily-guide/planner", "/en/privacy"]) {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const report = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(report.violations, `${route}: ${JSON.stringify(report.violations)}`).toEqual([]);
    }
  });

  test("visible controls expose names and keyboard focus", async ({ page }) => {
    await page.goto("/en/privacy");
    const controls = page.locator("a:visible, button:visible, input:visible, select:visible, textarea:visible");
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index += 1) {
      const name = await controls.nth(index).evaluate((element) => {
        const labelledBy = element.getAttribute("aria-labelledby");
        const labelledText = labelledBy
          ? labelledBy.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ")
          : "";
        return (element.getAttribute("aria-label") || labelledText || element.getAttribute("title") ||
          (element as HTMLInputElement).labels?.[0]?.textContent || element.textContent || "")
          .replace(/\s+/g, " ").trim();
      });
      expect(name, `unnamed visible control at index ${index}`).not.toBe("");
    }
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveCount(1);
    await expect(page.locator(":focus")).toBeVisible();
    for (let index = 0; index < Math.min(count, 12); index += 1) {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveCount(1);
      await expect(page.locator(":focus")).toBeVisible();
    }
  });
});
