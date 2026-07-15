import { test, expect, type Page } from "@playwright/test";
import { DICTS } from "./helpers";

async function expectNoHorizontalScroll(page: Page) {
  const hasHScroll = await page.evaluate(
    () => document.body.scrollWidth > window.innerWidth + 5,
  );
  expect(hasHScroll).toBe(false);
}

test("fresh unlocalized visit lands on Sinhala", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/si$/);
  await expect(page.getByText(DICTS.si.platform.tagline)).toBeVisible();
});

test("language switch presents Sinhala first and keeps English available", async ({ page }) => {
  await page.goto("/si");
  const buttons = page.getByRole("group", { name: DICTS.si.ui.languageSwitch }).getByRole("button");
  await expect(buttons.first()).toHaveText("සිංහල");
  await expect(buttons.nth(1)).toHaveText("English");

  await buttons.nth(1).click();
  await page.waitForURL(/\/en$/);
  await expect(page.getByText(DICTS.en.platform.tagline)).toBeVisible();
});

test("Sinhala Panchanga exposes Sri Lankan quick locations", async ({ page }) => {
  await page.goto("/si/panchanga");
  await expect(page.locator('[data-testid="panchanga-result"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(DICTS.si.ui.sriLankaLocations)).toBeVisible();
  await page
    .locator('[data-testid="sri-lanka-location-picks"]')
    .getByRole("button", { name: "මහනුවර" })
    .click();
  await expect(page.locator('[data-testid="active-location"]')).toContainText(
    `මහනුවර, ${DICTS.si.ui.countrySriLanka}`,
    { timeout: 30_000 },
  );
});

test("@mobile Sinhala-first pages fit 360px", async ({ page }) => {
  for (const path of ["/si", "/si/pancha-pakshi", "/si/panchanga", "/si/compatibility"]) {
    await page.goto(path);
    await expectNoHorizontalScroll(page);
  }
});

test("@mobile active navigation is marked without page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/si/panchanga");
  await expect(page.locator('[aria-current="page"]').getByText(DICTS.si.nav.panchanga)).toBeVisible();
  await expectNoHorizontalScroll(page);
});
