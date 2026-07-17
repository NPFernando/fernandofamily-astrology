import { test, expect } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function openPanchanga(page: import("@playwright/test").Page, locale: LocaleKey) {
  await page.goto(`/${locale}/panchanga`);
  await waitForPanchangaResult(page, locale);
}

async function waitForPanchangaResult(page: import("@playwright/test").Page, locale: LocaleKey) {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    if (await page.locator('[data-testid="panchanga-result"]').isVisible().catch(() => false)) return;

    const retry = page.getByRole("button", { name: DICTS[locale].ui.retry, exact: true }).first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  await expect(page.locator('[data-testid="panchanga-result"]')).toBeVisible();
}

async function waitForPanchangaTextChange(
  page: import("@playwright/test").Page,
  locale: LocaleKey,
  before: string | null,
) {
  const deadline = Date.now() + 75_000;
  while (Date.now() < deadline) {
    const after = await page
      .locator('[data-testid="panchanga-result"] > p')
      .first()
      .textContent()
      .catch(() => null);
    if (after && after !== before) return;

    const retry = page.getByRole("button", { name: DICTS[locale].ui.retry, exact: true }).first();
    if (await retry.isVisible().catch(() => false)) await retry.click();
    await page.waitForTimeout(500);
  }
  const after = await page.locator('[data-testid="panchanga-result"] > p').first().textContent();
  expect(after).not.toBe(before);
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
    await expect(page.locator('[data-testid="panchanga-timing-timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="panchanga-kalams"]')).toBeVisible();
    await expect(page.locator('[data-testid="panchanga-kalams"]').getByText(dict.panchanga.rahuKala)).toBeVisible();
    await expect(page.getByText(dict.dailyGuide.timeline.title)).toBeVisible();
    // Element cards must show real values, not empty shells: the tithi card
    // has at least one "until HH:MM" line.
    const tithiText = await page.locator('[data-testid="panchanga-tithi"]').textContent();
    expect(tithiText).toContain(dict.panchanga.until);
    watcher.assertClean();
  });
}

// 2026-07-29 is a real gazetted Poya day (Esala Full Moon Poya Day,
// non-adhi) confirmed against apps/api/tests/fixtures/sl_poya_2021_2026.json
// and the engine's own /api/v1/panchanga/daily response — used here instead
// of a made-up date so this test fails if the gazette-agreement rule ever
// regresses. Deliberately NOT 2026-05-30: that is the one documented
// tradition/convention divergence (gazette "Vesak", engine "adhi-poson"),
// so it would make this test flaky for the wrong reason.
const REAL_POYA_DATE = "2026-07-29";

async function gotoDate(page: import("@playwright/test").Page, date: string) {
  await page.locator('input[type="date"]').fill(date);
  await page.waitForTimeout(300);
}

for (const locale of ["en", "si"] as const) {
  test(`panchanga (${locale}): Poya badge shows on a real gazetted Poya day`, async ({ page }) => {
    await openPanchanga(page, locale);
    const dict = DICTS[locale];
    await gotoDate(page, REAL_POYA_DATE);
    const badge = page.locator('[data-testid="panchanga-poya-badge"]');
    await expect(badge).toBeVisible({ timeout: 20_000 });
    await expect(badge).toContainText(dict.panchanga.poyaTodayLabel);
    // Esala is a base (non-adhi) month — the badge must show the plain
    // Sinhala month name, not an "Adhi" prefix that doesn't apply this year.
    await expect(badge).toContainText(dict.enums.sinhalaMonths.esala);
  });
}

test("panchanga: no Poya badge on an ordinary day, and the next-Poya line is present and correct", async ({
  page,
}) => {
  await openPanchanga(page, "en");
  const dict = DICTS.en;
  await gotoDate(page, "2026-07-15"); // the day after this real Poya is 07-29
  await expect(page.locator('[data-testid="panchanga-poya-badge"]')).toHaveCount(0);
  const nextPoya = page.locator('[data-testid="panchanga-next-poya"]');
  await expect(nextPoya).toBeVisible();
  await expect(nextPoya).toContainText(dict.panchanga.nextPoyaLabel);
  await expect(nextPoya).toContainText(dict.enums.sinhalaMonths.esala);
});

test("panchanga (si): Sinhala Poya month is the primary name shown, not the Sanskrit amanta name alone", async ({
  page,
}) => {
  await openPanchanga(page, "si");
  await gotoDate(page, "2026-07-15"); // amanta "ashadha" / Sinhala "esala"
  const dict = DICTS.si;
  const monthCard = page.locator('[data-testid="panchanga-sinhala-month"]');
  await expect(monthCard).toContainText(dict.enums.sinhalaMonths.esala);
});

test("panchanga: date navigation changes the displayed date", async ({ page }) => {
  await openPanchanga(page, "en");
  const dict = DICTS.en;
  const before = await page.locator('[data-testid="panchanga-result"] > p').first().textContent();
  await page.getByRole("button", { name: dict.ui.nextDay }).click();
  await waitForPanchangaTextChange(page, "en", before);
});

test("panchanga: date and location controls appear before results", async ({ page }) => {
  await openPanchanga(page, "en");
  const controls = page.locator('[data-testid="panchanga-controls"]');
  const result = page.locator('[data-testid="panchanga-result"]');
  await expect(controls).toBeVisible();
  await expect(controls.getByRole("button", { name: DICTS.en.ui.nextDay })).toBeVisible();
  await expect(controls.locator('[data-testid="active-location"]')).toBeVisible();
  await controls.getByRole("button", { name: DICTS.en.ui.changeLocation, exact: true }).click();
  await expect(controls.getByText(DICTS.en.ui.sriLankaLocations)).toBeVisible();
  const controlsBox = await controls.boundingBox();
  const resultBox = await result.boundingBox();
  expect(controlsBox && resultBox && controlsBox.y < resultBox.y).toBeTruthy();
});

test("@mobile panchanga keeps controls above results without horizontal scroll", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openPanchanga(page, "en");
  await expect(page.locator('[data-testid="panchanga-controls"]')).toBeVisible();
  const hasHScroll = await page.evaluate(
    () => document.body.scrollWidth > window.innerWidth + 5,
  );
  expect(hasHScroll).toBe(false);
});

test("panchanga: nav link and landing feature card are present", async ({ page }) => {
  const dict = DICTS.en;
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(dict.features.panchanga.title) }).first(),
  ).toBeVisible();
  await openPanchanga(page, "en");
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
