import { test, expect } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, waitForSchedule, type LocaleKey } from "./helpers";

const SAMPLE = {
  date: "2000-01-01",
  time: "12:00:00",
  bird: "crow",
} as const;

async function openBirthNakshatra(page: import("@playwright/test").Page, locale: LocaleKey) {
  await page.goto(`/${locale}/birth-nakshatra`);
  await expect(page.locator('[data-testid="birth-nakshatra-controls"]')).toBeVisible();
}

async function calculateSample(page: import("@playwright/test").Page, locale: LocaleKey) {
  await openBirthNakshatra(page, locale);
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: DICTS[locale].birthNakshatra.calculate }).click();
  await expect(page.locator('[data-testid="birth-nakshatra-result"]')).toBeVisible({ timeout: 20_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`birth nakshatra (${locale}): calculates birth identity without URL leakage`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await calculateSample(page, locale);
    const dict = DICTS[locale];
    await expect(page.locator('[data-testid="birth-nakshatra-result"]')).toContainText(
      dict.enums.birds[SAMPLE.bird],
    );
    await expect(page.locator('[data-testid="birth-nakshatra-result"]')).toContainText(
      dict.birthNakshatra.moonRashi,
    );
    watcher.assertClean();
  });
}

test("birth nakshatra: quick action opens Pancha Pakshi with derived identity", async ({
  page,
}) => {
  await calculateSample(page, "en");
  await page.getByRole("button", { name: DICTS.en.birthNakshatra.openPanchaPakshi }).click();
  await expect(page).toHaveURL(/\/en\/pancha-pakshi$/);
  await waitForSchedule(page, "en");
  await expect(page.getByText(DICTS.en.enums.birds[SAMPLE.bird]).first()).toBeVisible();
});

test("birth nakshatra: quick action opens Daily Guide with derived identity", async ({
  page,
}) => {
  await calculateSample(page, "en");
  await page.getByRole("button", { name: DICTS.en.birthNakshatra.openDailyGuide }).click();
  await expect(page).toHaveURL(/\/en\/daily-guide$/);
  await expect(page.locator('[data-testid="daily-guide-result"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid="daily-guide-summary"]')).toContainText(
    DICTS.en.enums.birds[SAMPLE.bird],
  );
});

test("birth nakshatra: saving profile stores only derived fields", async ({ page }) => {
  await calculateSample(page, "en");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(DICTS.en.ui.profileLabelPrompt);
    await dialog.accept("Sample birth");
  });
  await page.getByRole("button", { name: DICTS.en.ui.saveAsProfile }).click();
  await expect(page.getByRole("button", { name: DICTS.en.ui.profileSaved })).toBeVisible();
  const raw = await page.evaluate(() => window.localStorage.getItem("ff_saved_profiles"));
  expect(raw).toContain("nakshatra_index");
  expect(raw).toContain("paksha");
  expect(raw).not.toContain("birth_date");
  expect(raw).not.toContain("birth_time");
  expect(raw).not.toContain("latitude");
  expect(raw).not.toContain("longitude");
});

test("@mobile birth nakshatra fits 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await calculateSample(page, "si");
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 5);
  expect(hasHScroll).toBe(false);
});

test("birth nakshatra: landing card, nav link, and sitemap are present", async ({
  page,
  request,
}) => {
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(DICTS.en.features.birthNakshatra.title) }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: DICTS.en.nav.birthNakshatra }).first().click();
  await expect(page).toHaveURL(/\/en\/birth-nakshatra$/);

  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/birth-nakshatra");
  expect(body).toContain("/si/birth-nakshatra");
});
