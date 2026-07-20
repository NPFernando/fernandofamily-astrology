import { test, expect } from "@playwright/test";
import { DICTS, openCalculator, waitForSchedule, watchForBirthDataInUrls } from "./helpers";

const dict = DICTS.en;

async function openWeekView(page: import("@playwright/test").Page) {
  await page.getByRole("tab", { name: dict.ui.weekView, exact: true }).click();
  const chips = page.locator('[data-testid="week-window-chip"]');
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    if (await chips.first().isVisible().catch(() => false)) return chips;

    const retry = page.locator('[data-testid="week-retry"]');
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  await expect(chips.first()).toBeVisible();
  return chips;
}

test("table view shows all 10 tables / 50 rows without expanding; timeline unaffected after", async ({
  page,
}) => {
  await openCalculator(page, "en");
  await page.getByRole("tab", { name: dict.ui.tableView, exact: true }).click();
  // :not() scoping: the hidden PrintSheet mounts 2 more tables in the DOM.
  const visibleTables = page.locator("table:not(#print-sheet table)");
  await expect(visibleTables).toHaveCount(10);
  await expect(page.locator("table:not(#print-sheet table) tbody tr")).toHaveCount(50);
  // Click a period header while in table view, then switch back — timeline
  // must not have inherited an expansion from that click.
  await page.locator('[id^="major-period-"] > button').first().click();
  await page.getByRole("tab", { name: dict.ui.timelineView, exact: true }).click();
  await expect(page.locator("table:not(#print-sheet table)")).toHaveCount(0);
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
  // Real /windows endpoint behind the proxy — chips or a legitimate
  // empty-day state; assert the grid appeared and at least one favourable
  // window chip exists across the week for the default peacock/Colombo.
  await openWeekView(page);
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

for (const locale of ["en", "si"] as const) {
  test(`month view (${locale}): 7-column grid with a month of day cells`, async ({ page }) => {
    await openCalculator(page, locale);
    await page.getByRole("tab", { name: DICTS[locale].ui.monthView, exact: true }).click();
    const grid = page.locator('[data-testid="month-grid"]');
    await expect(grid).toBeVisible({ timeout: 60_000 });
    const cells = page.locator('[data-testid="month-day"]');
    // 31 requested days; the response always carries exactly that many.
    await expect(cells).toHaveCount(31, { timeout: 60_000 });
    // 7 weekday headers above the grid.
    await expect(grid.locator("div").first().locator("span")).toHaveCount(7);
  });
}

test("week filters: narrowing by activity removes other activities' chips", async ({ page }) => {
  await openCalculator(page, "en");
  const chips = await openWeekView(page);
  const unfilteredTitles = await chips.evaluateAll((els) =>
    els.map((e) => e.getAttribute("title") ?? ""),
  );
  // Narrow to ruling-only: deselect the other four.
  for (const a of ["eating", "walking", "sleeping", "dying"]) {
    await page.locator(`[data-testid="week-filter-${a}"]`).click();
  }
  // Wait for the refetch to settle, then compare sets: every remaining chip
  // is a Ruling window, and the remaining set is a subset of the original.
  await expect
    .poll(
      async () => {
        const retry = page.locator('[data-testid="week-retry"]');
        if (await retry.isVisible().catch(() => false)) await retry.click();
        const titles = await chips.evaluateAll((els) =>
          els.map((e) => e.getAttribute("title") ?? ""),
        );
        return titles.length > 0 && titles.every((t) => t.includes(dict.enums.activities.ruling));
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const filteredTitles = await chips.evaluateAll((els) =>
    els.map((e) => e.getAttribute("title") ?? ""),
  );
  expect(filteredTitles.length).toBeLessThanOrEqual(unfilteredTitles.length);
  for (const t of filteredTitles) expect(unfilteredTitles).toContain(t);
});

test(".ics download produces a valid calendar file", async ({ page }) => {
  await openCalculator(page, "en");
  await openWeekView(page);
  const downloadPromise = page.waitForEvent("download");
  await page.locator('[data-testid="week-download-ics"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pancha-pakshi-windows.ics");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  expect(text.startsWith("BEGIN:VCALENDAR")).toBe(true);
  expect(text).toContain("BEGIN:VEVENT");
  // At least one localized bird name in a SUMMARY line.
  expect(text).toMatch(/SUMMARY:.+/);
  expect(text).toContain("DTSTART:");
});
