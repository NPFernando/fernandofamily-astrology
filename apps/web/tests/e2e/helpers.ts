import { expect, type Page } from "@playwright/test";
import en from "../../locales/en.json";
import si from "../../locales/si.json";

export const DICTS = { en, si } as const;
export type LocaleKey = keyof typeof DICTS;

// Fields that must never appear in any request URL (spec §11) — asserted on
// every navigation/fetch the browser makes during a test.
const FORBIDDEN_URL_FIELDS = [
  "birth_date",
  "birth_time",
  "latitude",
  "longitude",
  "nakshatra_index",
  "target_date",
  "target_time",
];

export function watchForBirthDataInUrls(page: Page) {
  const violations: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    for (const field of FORBIDDEN_URL_FIELDS) {
      if (url.includes(`${field}=`)) violations.push(`${field} in ${url.slice(0, 120)}`);
    }
  });
  return {
    assertClean() {
      expect(violations, "birth/location fields must never appear in URLs").toEqual([]);
    },
  };
}

// The zero-click auto-compute means every plain load ends in a schedule —
// wait for it so subsequent interactions have a stable page.
export async function waitForSchedule(page: Page, locale: LocaleKey) {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    const liveCountdown = await page
      .getByText(DICTS[locale].ui.timeRemaining)
      .first()
      .isVisible()
      .catch(() => false);
    const scheduleCards = await page
      .locator('[id^="major-period-"]')
      .first()
      .isVisible()
      .catch(() => false);
    if (liveCountdown || scheduleCards) return;

    const retry = page.getByRole("button", { name: DICTS[locale].ui.retry, exact: true }).first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  await expect(page.getByText(DICTS[locale].ui.timeRemaining).first()).toBeVisible();
}

export async function openCalculator(page: Page, locale: LocaleKey) {
  await page.goto(`/${locale}/pancha-pakshi`);
  await waitForSchedule(page, locale);
}

export async function openToolsContext(page: Page) {
  const panel = page.getByTestId("tools-context-panel");
  await expect(panel).toBeVisible();
  const isOpen = await panel.evaluate((node) => (node as HTMLDetailsElement).open);
  if (!isOpen) await panel.locator("summary").first().click();
  return panel;
}

// Fills the manual-coordinates location path (works in any form embedding
// LocationPicker) with Colombo unless overridden.
export async function fillManualLocation(
  page: Page,
  locale: LocaleKey,
  coords: { lat: string; lon: string; tz: string } = {
    lat: "6.9271",
    lon: "79.8612",
    tz: "Asia/Colombo",
  },
) {
  const dict = DICTS[locale];
  const panel = page.getByRole("tabpanel");
  const change = panel.getByRole("button", { name: dict.ui.changeLocation, exact: true });
  if (await change.isVisible().catch(() => false)) await change.click();
  await panel.getByRole("button", { name: dict.ui.manualEntry, exact: true }).click();
  await panel.getByPlaceholder(dict.ui.latitude).fill(coords.lat);
  await panel.getByPlaceholder(dict.ui.longitude).fill(coords.lon);
  await panel.getByPlaceholder(dict.ui.timezone).fill(coords.tz);
  await panel.getByRole("button", { name: dict.ui.confirm, exact: true }).first().click();
}

export async function expectMainBird(page: Page, locale: LocaleKey, birdKey: string) {
  const dict = DICTS[locale];
  const birdLabel = (dict.enums.birds as Record<string, string>)[birdKey];
  const mainLine = page.getByText(`${dict.ui.mainBird}:`).locator("xpath=..");
  await expect(mainLine).toContainText(birdLabel, { timeout: 20_000 });
}
