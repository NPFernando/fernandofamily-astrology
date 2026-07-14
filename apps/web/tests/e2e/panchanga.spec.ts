import { test, expect } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function openPanchanga(page: import("@playwright/test").Page, locale: LocaleKey) {
  await page.goto(`/${locale}/panchanga`);
  await expect(page.locator('[data-testid="panchanga-result"]')).toBeVisible({ timeout: 30_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`panchanga (${locale}): zero-click render with element cards and kalams`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await openPanchanga(page, locale);
    const dict = DICTS[locale];
    for (const id of [
      "panchanga-tithi",
      "panchanga-nakshatra",
      "panchanga-yoga",
      "panchanga-karana",
      "panchanga-month",
      "panchanga-weekday",
    ]) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-testid="panchanga-kalams"]')).toBeVisible();
    await expect(page.getByText(dict.panchanga.rahuKala)).toBeVisible();
    // Element cards must show real values, not empty shells: the tithi card
    // has at least one "until HH:MM" line.
    const tithiText = await page.locator('[data-testid="panchanga-tithi"]').textContent();
    expect(tithiText).toContain(dict.panchanga.until);
    watcher.assertClean();
  });
}

test("panchanga: date navigation changes the displayed date", async ({ page }) => {
  await openPanchanga(page, "en");
  const dict = DICTS.en;
  const before = await page.locator('[data-testid="panchanga-result"] > p').first().textContent();
  await page.getByRole("button", { name: dict.ui.nextDay }).click();
  await expect(async () => {
    const after = await page.locator('[data-testid="panchanga-result"] > p').first().textContent();
    expect(after).not.toBe(before);
  }).toPass({ timeout: 20_000 });
});

test("panchanga: nav link and landing feature card are present", async ({ page }) => {
  const dict = DICTS.en;
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(dict.features.panchanga.title) }).first(),
  ).toBeVisible();
  await page.goto("/en/panchanga");
  await expect(page.locator('[data-testid="panchanga-result"]')).toBeVisible({ timeout: 30_000 });
});

test("panchanga: sitemap lists both locales", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/panchanga");
  expect(body).toContain("/si/panchanga");
});

test("panchanga: print emulation hides controls, keeps cards", async ({ page }) => {
  await openPanchanga(page, "en");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator('[data-testid="panchanga-tithi"]')).toBeVisible();
  await expect(page.locator('[data-testid="panchanga-kalams"]')).toBeVisible();
  // Interactive controls hidden in print.
  const dict = DICTS.en;
  await expect(page.getByRole("button", { name: dict.ui.nextDay })).toBeHidden();
});

test("@mobile panchanga at 360px without horizontal scroll", async ({ page }) => {
  await openPanchanga(page, "en");
  const hasHScroll = await page.evaluate(
    () => document.body.scrollWidth > window.innerWidth + 5,
  );
  expect(hasHScroll).toBe(false);
});
