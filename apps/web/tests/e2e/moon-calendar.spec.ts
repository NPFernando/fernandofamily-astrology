import { test, expect } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function openMoonCalendar(page: import("@playwright/test").Page, locale: LocaleKey) {
  await page.goto(`/${locale}/moon-calendar`);
  await waitForMoonCalendar(page, locale);
}

async function waitForMoonCalendar(page: import("@playwright/test").Page, locale: LocaleKey) {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    if (await page.locator('[data-testid="moon-calendar-result"]').isVisible().catch(() => false)) return;
    const retry = page.getByRole("button", { name: DICTS[locale].ui.retry, exact: true }).first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  await expect(page.locator('[data-testid="moon-calendar-result"]')).toBeVisible();
}

for (const locale of ["en", "si"] as const) {
  test(`moon calendar (${locale}): zero-click render shows month and selected day`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await openMoonCalendar(page, locale);
    await expect(page.locator('[data-testid="moon-calendar-controls"]')).toBeVisible();
    await expect(page.locator('[data-testid="moon-calendar-grid"]')).toBeVisible();
    const selected = page.locator('[data-testid="moon-calendar-selected-day"]');
    await expect(selected).toBeVisible();
    await expect(selected.getByText(DICTS[locale].moonCalendar.moonPhase)).toBeVisible();
    watcher.assertClean();
  });
}

test("moon calendar: July 2026 highlights the real Esala Poya day", async ({ page }) => {
  await openMoonCalendar(page, "en");
  await page.locator('input[type="month"]').fill("2026-07");
  const poya = page.locator('[data-testid="moon-calendar-poya"]').first();
  await expect(poya).toBeVisible({ timeout: 30_000 });
  await expect(poya).toContainText(DICTS.en.moonCalendar.poyaShort);
  await poya.click();
  const selected = page.locator('[data-testid="moon-calendar-selected-day"]');
  await expect(selected).toContainText(DICTS.en.enums.sinhalaMonths.esala, { timeout: 30_000 });
  await expect(page.locator('[data-testid="moon-calendar-poya-detail"]')).toContainText(
    DICTS.en.panchanga.poyaTodayLabel,
  );
});

test("moon calendar: date query and Daily Guide action use the selected day", async ({ page }) => {
  await page.goto("/en/moon-calendar?date=2026-07-29");
  await waitForMoonCalendar(page, "en");
  const detail = page.locator('[data-testid="moon-calendar-poya-detail"]');
  await expect(detail).toContainText(DICTS.en.enums.sinhalaMonths.esala);
  await detail.getByRole("link", { name: DICTS.en.moonCalendar.openDailyGuide }).click();
  await expect(page).toHaveURL(/\/en\/daily-guide\?date=2026-07-29$/);
  await expect(page.locator('[data-testid="daily-guide-poya-detail"]')).toContainText(
    DICTS.en.panchanga.poyaTodayLabel,
    { timeout: 30_000 },
  );
});

test("@mobile moon calendar uses list layout without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openMoonCalendar(page, "en");
  await expect(page.locator('[data-testid="moon-calendar-mobile-list"]')).toBeVisible();
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 5);
  expect(hasHScroll).toBe(false);
});

test("moon calendar: landing card, nav link, and sitemap are present", async ({ page, request }) => {
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(DICTS.en.features.moonCalendar.title) }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: DICTS.en.nav.moonCalendar }).first().click();
  await expect(page).toHaveURL(/\/en\/moon-calendar$/);

  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/moon-calendar");
  expect(body).toContain("/si/moon-calendar");
});
