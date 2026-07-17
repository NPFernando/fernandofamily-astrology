import { test, expect } from "@playwright/test";
import { DICTS, openCalculator, watchForBirthDataInUrls } from "./helpers";

async function waitForLiveView(page: import("@playwright/test").Page, locale: keyof typeof DICTS) {
  await expect(page.getByTestId("ambient-live-view")).toBeVisible({ timeout: 75_000 });
  await expect(page.getByText(DICTS[locale].ui.timeRemaining).first()).toBeVisible({ timeout: 75_000 });
}

test("direct Pancha Pakshi live view renders the ambient countdown", async ({ page }) => {
  await page.goto("/en/pancha-pakshi/live");
  await waitForLiveView(page, "en");
  await expect(page.getByText(DICTS.en.ui.exitLiveView)).toBeVisible();
  await expect(page.getByText(DICTS.en.ui.mainBird).first()).toBeVisible();
  await expect(page.getByText(DICTS.en.ui.subBird).first()).toBeVisible();
  await expect(page.getByTestId("live-birth-bird")).toBeVisible();
});

test("calculator live-view handoff keeps birth and location fields out of URLs", async ({ page }) => {
  const watcher = watchForBirthDataInUrls(page);
  await openCalculator(page, "en");
  await page.getByRole("link", { name: DICTS.en.ui.liveView, exact: true }).click();
  await page.waitForURL(/\/en\/pancha-pakshi\/live/);
  await waitForLiveView(page, "en");
  watcher.assertClean();
});

test("Sinhala Pancha Pakshi live view renders localized controls", async ({ page }) => {
  await page.goto("/si/pancha-pakshi/live");
  await waitForLiveView(page, "si");
  await expect(page.getByText(DICTS.si.ui.exitLiveView)).toBeVisible();
  await expect(page.getByText(DICTS.si.metadata.panchaPakshiLive.title)).toBeVisible();
});

test("@mobile Pancha Pakshi live view has no horizontal scroll at 360px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/en/pancha-pakshi/live");
  await waitForLiveView(page, "en");
  const hasHScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 5,
  );
  expect(hasHScroll).toBe(false);
});

test("sitemap includes localized live view routes", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.ok()).toBe(true);
  const xml = await response.text();
  expect(xml).toContain("/en/pancha-pakshi/live");
  expect(xml).toContain("/si/pancha-pakshi/live");
});
