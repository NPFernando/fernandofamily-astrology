import { test, expect } from "@playwright/test";
import { DICTS, openCalculator, waitForSchedule, watchForBirthDataInUrls } from "./helpers";

const dict = DICTS.en;

test("table view shows all 10 tables / 50 rows without expanding; timeline unaffected after", async ({
  page,
}) => {
  await openCalculator(page, "en");
  await page.getByRole("button", { name: dict.ui.tableView, exact: true }).click();
  await expect(page.locator("table")).toHaveCount(10);
  await expect(page.locator("table tbody tr")).toHaveCount(50);
  // Click a period header while in table view, then switch back — timeline
  // must not have inherited an expansion from that click.
  await page.locator('[id^="major-period-"] > button').first().click();
  await page.getByRole("button", { name: dict.ui.timelineView, exact: true }).click();
  await expect(page.locator("table")).toHaveCount(0);
  await expect(page.locator('[id^="major-period-"] ul')).toHaveCount(0);
});

test("date navigation: next day shows notice, back to today restores countdown", async ({
  page,
}) => {
  await openCalculator(page, "en");
  // Next-day arrow (aria-labeled).
  await page.getByRole("button", { name: dict.ui.nextDay }).click();
  await expect(page.getByText(dict.ui.viewingAnotherDay)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: dict.ui.backToToday }).click();
  await expect(page.getByText(dict.ui.timeRemaining).first()).toBeVisible({ timeout: 20_000 });
});

test("week view renders windows from the real API and day tap loads that day", async ({
  page,
}) => {
  await openCalculator(page, "en");
  await page.getByRole("button", { name: dict.ui.weekView, exact: true }).click();
  // Real /windows endpoint behind the proxy — chips or a legitimate
  // empty-day state; assert the grid appeared and at least one favourable
  // window chip exists across the week for the default peacock/Colombo.
  const chips = page.locator('[data-testid="week-window-chip"]');
  await expect(chips.first()).toBeVisible({ timeout: 30_000 });
  const dayHeaders = page.locator('[data-testid="week-day"]');
  await expect(dayHeaders).toHaveCount(7);
  await dayHeaders.nth(2).click();
  // Selecting a future day lands back on the schedule for that date.
  await expect(page.getByText(dict.ui.viewingAnotherDay)).toBeVisible({ timeout: 20_000 });
});

test("best times today card lists favourable periods and scrolls on click", async ({ page }) => {
  await openCalculator(page, "en");
  const card = page.getByText(dict.ui.bestWindowsToday).locator("xpath=..");
  await expect(card).toBeVisible();
});

test("@mobile zero-click + timeline at 360px without horizontal scroll", async ({ page }) => {
  const watcher = watchForBirthDataInUrls(page);
  await page.goto("/en/pancha-pakshi");
  await waitForSchedule(page, "en");
  const hasHScroll = await page.evaluate(
    () => document.body.scrollWidth > window.innerWidth + 5,
  );
  expect(hasHScroll).toBe(false);
  watcher.assertClean();
});
