import { expect, test } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function calculate(page: import("@playwright/test").Page, locale: LocaleKey) {
  await page.goto(`/${locale}/ashtakavarga`);
  await page.locator('input[type="date"]').fill("2000-01-01");
  await page.locator('input[type="time"]').fill("12:00");
  await page.getByRole("button", { name: DICTS[locale].ashtakavarga.calculate }).click();
  await expect(page.getByTestId("ashtakavarga-result")).toBeVisible({ timeout: 30_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`ashtakavarga (${locale}): calculates 12 houses without URL leakage`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await calculate(page, locale);
    await expect(page.getByTestId("ashtakavarga-result")).toContainText("337");
    await expect(page.getByTestId("ashtakavarga-result").locator("div.border")).toHaveCount(12);
    watcher.assertClean();
  });
}

test("ashtakavarga: reuses the same-tab calculation and supports print", async ({ page }) => {
  await calculate(page, "en");
  await page.goto("/en/ashtakavarga");
  await expect(page.getByTestId("birth-calculation-handoff")).toBeVisible();
  await expect(page.getByTestId("ashtakavarga-result")).toBeVisible();
  await expect(page.getByRole("button", { name: DICTS.en.ui.print })).toBeVisible();
});
