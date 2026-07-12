import { test, expect } from "@playwright/test";
import {
  DICTS,
  type LocaleKey,
  openCalculator,
  fillManualLocation,
  expectMainBird,
  watchForBirthDataInUrls,
  waitForSchedule,
} from "./helpers";

const LOCALES: LocaleKey[] = ["en", "si"];

for (const locale of LOCALES) {
  const dict = DICTS[locale];

  test.describe(`calculator (${locale})`, () => {
    test(`zero-click: plain load auto-computes with defaults`, async ({ page }) => {
      const watcher = watchForBirthDataInUrls(page);
      await page.goto(`/${locale}/pancha-pakshi`);
      await waitForSchedule(page, locale);
      await expect(page.getByText(dict.ui.defaultsNotice)).toBeVisible();
      watcher.assertClean();
    });

    test(`method C: direct bird → 10 major periods, main bird correct`, async ({ page }) => {
      const watcher = watchForBirthDataInUrls(page);
      await openCalculator(page, locale);
      await page.getByRole("tab", { name: dict.ui.methodDirectBird }).click();
      await page.getByRole("button", { name: dict.enums.birds.cock, exact: true }).click();
      await fillManualLocation(page, locale);
      await page.getByRole("button", { name: dict.ui.calculate, exact: true }).click();
      await expectMainBird(page, locale, "cock");
      // 10 major-period cards render (5 day + 5 night).
      await expect(page.locator('[id^="major-period-"]')).toHaveCount(10);
      // Explicit choice clears the defaults notice.
      await expect(page.getByText(dict.ui.defaultsNotice)).toBeHidden();
      watcher.assertClean();
    });

    test(`method B: nakshatra 1 + waxing → Vulture`, async ({ page }) => {
      const watcher = watchForBirthDataInUrls(page);
      await openCalculator(page, locale);
      await page.getByRole("tab", { name: dict.ui.methodKnownNakshatra }).click();
      await page.locator("select").first().selectOption({ index: 1 }); // Ashwini (id 1)
      await page.getByText(dict.enums.paksha.waxing, { exact: false }).first().click();
      await fillManualLocation(page, locale);
      await page.getByRole("button", { name: dict.ui.calculate, exact: true }).click();
      await expectMainBird(page, locale, "vulture");
      watcher.assertClean();
    });

    test(`method A: birth details → Crow confirmed → schedule`, async ({ page }) => {
      const watcher = watchForBirthDataInUrls(page);
      await openCalculator(page, locale);
      await page.getByRole("tab", { name: dict.ui.methodBirthDetails }).click();
      // Scope to the tab panel: the results header above it also has a date
      // input (DateNav) since the zero-click feature landed.
      const panel = page.getByRole("tabpanel");
      await panel.locator('input[type="date"]').first().fill("1996-12-07");
      await panel.locator('input[type="time"]').first().fill("10:34");
      await fillManualLocation(page, locale, {
        lat: "13.0878",
        lon: "80.2785",
        tz: "Asia/Kolkata",
      });
      // The main form Confirm is the last one (location picker's came first).
      await page.getByRole("button", { name: dict.ui.confirm, exact: true }).last().click();
      const confirmation = page.getByText(dict.ui.confirmBirthBird).locator("xpath=..");
      await expect(confirmation).toContainText(dict.enums.birds.crow, { timeout: 20_000 });
      await page.getByRole("button", { name: dict.ui.proceedToSchedule }).click();
      await expectMainBird(page, locale, "crow");
      watcher.assertClean();
    });
  });
}

test("language persistence: schedule and chips survive switch to si; reload keeps si", async ({
  page,
}) => {
  await openCalculator(page, "en");
  // Save a profile so a chip exists to check after the switch.
  page.once("dialog", (d) => d.accept("E2E Person"));
  await page.getByRole("button", { name: DICTS.en.ui.saveAsProfile }).click();
  await expect(page.getByText("E2E Person")).toBeVisible();

  await page.getByRole("button", { name: "සිංහල" }).click();
  await page.waitForURL(/\/si\/pancha-pakshi/);
  await expect(page.getByText(DICTS.si.ui.timeRemaining).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("E2E Person")).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/si\//);
});

test("saved profiles: save → chip → schedule from chip → delete", async ({ page }) => {
  const dict = DICTS.en;
  await openCalculator(page, "en");
  page.once("dialog", (d) => d.accept("Amma"));
  await page.getByRole("button", { name: dict.ui.saveAsProfile }).click();
  const chip = page.getByRole("button", { name: /Amma/ });
  await expect(chip.first()).toBeVisible();
  await chip.first().click();
  await waitForSchedule(page, "en");
  // Delete the chip (remove affordance next to it).
  await page.getByRole("button", { name: dict.ui.deleteProfile }).first().click();
  await expect(page.getByText("Amma")).toBeHidden();
});
