import { test, expect, type Page } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

const BRIDE = { date: "2000-01-01", time: "06:00" };
const GROOM = { date: "1998-06-15", time: "18:30" };

async function fillParty(page: Page, legend: string, sample: { date: string; time: string }) {
  const fieldset = page.locator("fieldset", { hasText: legend });
  await fieldset.locator('input[type="date"]').fill(sample.date);
  await fieldset.locator('input[type="time"]').fill(sample.time);
}

async function calculatePorondam(page: Page, locale: LocaleKey) {
  const dict = DICTS[locale];
  await page.goto(`/${locale}/porondam`);
  await expect(page.getByRole("heading", { name: dict.porondam.title })).toBeVisible();
  await fillParty(page, dict.porondam.brideTitle, BRIDE);
  await fillParty(page, dict.porondam.groomTitle, GROOM);
  await page.getByRole("button", { name: dict.porondam.calculate }).click();
  await expect(page.locator('[data-testid="porondam-result"]')).toBeVisible({ timeout: 20_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`porondam (${locale}): matches 7 core categories without URL leakage`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    const dict = DICTS[locale];
    await calculatePorondam(page, locale);

    // All 7 shipped categories render as rows, each explicitly Matched or
    // Not matched (never a silently-missing row).
    const matches = page.locator('[data-testid="porondam-matches"]');
    for (const key of ["nakshatra", "gana", "yoni", "rashi", "rashyadpathi", "vashya", "vedha"] as const) {
      await expect(matches).toContainText(dict.porondam.categories[key].name);
    }
    // The summary count must reflect exactly those 7 categories.
    await expect(page.locator('[data-testid="porondam-result"]')).toContainText(`/ 7`);
    watcher.assertClean();
  });
}

test("porondam: calculate stays disabled until both parties' details are complete", async ({ page }) => {
  const dict = DICTS.en;
  await page.goto("/en/porondam");
  const calculateButton = page.getByRole("button", { name: dict.porondam.calculate });
  await expect(calculateButton).toBeDisabled();
  await fillParty(page, dict.porondam.brideTitle, BRIDE);
  await expect(calculateButton).toBeDisabled();
  await fillParty(page, dict.porondam.groomTitle, GROOM);
  await expect(calculateButton).toBeEnabled();
});

test("porondam: nav link and sitemap are present", async ({ page, request }) => {
  const dict = DICTS.en;
  await page.goto("/en");
  await expect(page.getByRole("link", { name: dict.nav.porondam, exact: true })).toBeVisible();
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).toContain("/en/porondam");
});
