import { test, expect } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function waitForDailyGuide(page: import("@playwright/test").Page, locale: LocaleKey) {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    if (await page.locator('[data-testid="daily-guide-result"]').isVisible().catch(() => false)) return;

    const retry = page.getByRole("button", { name: DICTS[locale].ui.retry, exact: true }).first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  await expect(page.locator('[data-testid="daily-guide-result"]')).toBeVisible();
}

async function openDailyGuide(page: import("@playwright/test").Page, locale: LocaleKey) {
  await page.goto(`/${locale}/daily-guide`);
  await waitForDailyGuide(page, locale);
}

async function gotoDate(page: import("@playwright/test").Page, date: string) {
  await page.locator('input[type="date"]').fill(date);
  await page.waitForTimeout(300);
}

for (const locale of ["en", "si"] as const) {
  test(`daily guide (${locale}): zero-click render combines Panchanga and Pancha Pakshi`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await openDailyGuide(page, locale);
    const dict = DICTS[locale];

    await expect(page.locator('[data-testid="daily-guide-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-family-board"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-current"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-good-windows"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-supportive-timing"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-personal-strength"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-disha-shool"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-avoid-times"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-panchanga"]')).toBeVisible();
    await expect(page.locator('[data-testid="daily-guide-sun-moon"]')).toBeVisible();
    await expect(page.getByText(dict.panchanga.rahuKala)).toBeVisible();
    await expect(page.getByText(dict.panchanga.amritKaalamTitle)).toBeVisible();
    await expect(page.getByText(dict.panchanga.abhijitMuhurtaTitle)).toBeVisible();
    await expect(page.getByText(dict.panchanga.durmuhurtamTitle).first()).toBeVisible();
    await expect(page.getByText(dict.panchanga.nakshatra).first()).toBeVisible();
    watcher.assertClean();
  });
}

test("daily guide: real Poya date shows Poya badge and ordinary date shows next Poya", async ({
  page,
}) => {
  await openDailyGuide(page, "en");
  await gotoDate(page, "2026-07-29");
  const badge = page.locator('[data-testid="daily-guide-poya-badge"]');
  await expect(badge).toBeVisible({ timeout: 20_000 });
  await expect(badge).toContainText(DICTS.en.panchanga.poyaTodayLabel);

  await gotoDate(page, "2026-07-15");
  await expect(page.locator('[data-testid="daily-guide-poya-badge"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="daily-guide-next-poya"]')).toContainText(
    DICTS.en.enums.sinhalaMonths.esala,
  );
});

test("daily guide: known Nakshatra unlocks Tara Bala without birth data in URLs", async ({ page }) => {
  const watcher = watchForBirthDataInUrls(page);
  await openDailyGuide(page, "en");
  const picker = page.locator('[data-testid="daily-guide-known-nakshatra"]');
  await picker.locator("select").first().selectOption("1");
  await picker.locator("select").nth(1).selectOption("waxing");
  await picker.getByRole("button", { name: DICTS.en.dailyGuide.useKnownNakshatra }).click();

  await expect(page.locator('[data-testid="daily-guide-tara-bala"]')).not.toContainText(
    DICTS.en.dailyGuide.taraBalaPrompt,
    { timeout: 20_000 },
  );
  await expect(page.locator('[data-testid="daily-guide-tara-bala"]')).toContainText(
    DICTS.en.ui.taraBala,
  );
  watcher.assertClean();
});

test("daily guide: family day board compares saved profiles without birth data in URLs", async ({ page }) => {
  const watcher = watchForBirthDataInUrls(page);
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "ff_saved_profiles",
      JSON.stringify([
        {
          id: "family-enriched",
          label: "Amma",
          bird: null,
          nakshatra_index: 5,
          paksha: "waxing",
          moon_rashi_index: 7,
          created_at: "2026-07-17T00:00:00.000Z",
        },
        {
          id: "family-direct",
          label: "Appachchi",
          bird: "owl",
          nakshatra_index: null,
          paksha: null,
          moon_rashi_index: null,
          created_at: "2026-07-17T00:01:00.000Z",
        },
      ]),
    );
  });

  await openDailyGuide(page, "en");
  const board = page.locator('[data-testid="daily-guide-family-board"]');
  await expect(board).toContainText(DICTS.en.dailyGuide.familyBoardTitle);

  const enriched = board.locator('[data-testid="daily-guide-family-profile"]').filter({ hasText: "Amma" });
  await expect(enriched).toBeVisible({ timeout: 20_000 });
  await expect(enriched).not.toContainText(DICTS.en.dailyGuide.familyBoardNeedsNakshatra);
  await expect(enriched).not.toContainText(DICTS.en.dailyGuide.familyBoardNeedsMoonRashi);
  await expect(enriched).toContainText(DICTS.en.dailyGuide.familyBoardBestWindow);

  const direct = board.locator('[data-testid="daily-guide-family-profile"]').filter({ hasText: "Appachchi" });
  await expect(direct).toContainText(DICTS.en.dailyGuide.familyBoardNeedsNakshatra);
  await expect(direct).toContainText(DICTS.en.dailyGuide.familyBoardNeedsMoonRashi);
  await direct.getByRole("button", { name: DICTS.en.dailyGuide.familyBoardUseProfile }).click();
  await expect(page.locator('[data-testid="daily-guide-summary"]')).toContainText(
    DICTS.en.enums.birds.owl,
    { timeout: 20_000 },
  );

  watcher.assertClean();
});

test("daily guide: changing bird refreshes the guide identity", async ({ page }) => {
  await openDailyGuide(page, "en");
  await page.getByRole("button", { name: DICTS.en.enums.birds.owl, exact: true }).click();
  await expect(page.locator('[data-testid="daily-guide-summary"]')).toContainText(
    DICTS.en.enums.birds.owl,
    { timeout: 20_000 },
  );
});

test("@mobile daily guide keeps cards within 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openDailyGuide(page, "si");
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 5);
  expect(hasHScroll).toBe(false);
});

test("daily guide: landing card, nav link, and sitemap are present", async ({ page, request }) => {
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(DICTS.en.features.dailyGuide.title) }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: DICTS.en.nav.dailyGuide }).first().click();
  await expect(page).toHaveURL(/\/en\/daily-guide$/);
  await waitForDailyGuide(page, "en");

  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/daily-guide");
  expect(body).toContain("/si/daily-guide");
});
