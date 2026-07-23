import { expect, test, type Page } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

const SAMPLE = { date: "2000-01-01", time: "12:00" } as const;

async function calculateReport(page: Page, locale: LocaleKey) {
  await page.goto(`/${locale}/horoscope-report`);
  await expect(page.locator('[data-testid="horoscope-report-controls"]')).toBeVisible();
  await page.locator('input[type="date"]').fill(SAMPLE.date);
  await page.locator('input[type="time"]').fill(SAMPLE.time);
  await page.getByRole("button", { name: DICTS[locale].horoscopeReport.calculate }).click();
  await expect(page.locator('[data-testid="horoscope-report-result"]')).toBeVisible({ timeout: 30_000 });
}

for (const locale of ["en", "si"] as const) {
  test(`horoscope report (${locale}): combined identity, chart, and dasha render without URL leakage`, async ({
    page,
  }) => {
    const watcher = watchForBirthDataInUrls(page);
    await calculateReport(page, locale);
    const dict = DICTS[locale];
    await expect(page.locator('[data-testid="horoscope-report-identity"]')).toContainText(
      dict.horoscopeReport.derivedIdentityTitle,
    );
    await expect(page.locator('[data-testid="horoscope-report-summary"]')).toContainText(dict.enums.birds.crow);
    await expect(page.locator('[data-testid="horoscope-report-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="rasi-cell-mesha"]')).toBeVisible();
    await expect(page.locator('[data-testid="horoscope-report-current-dasha"]')).toContainText(
      dict.horoscopeReport.currentMahadasha,
    );
    await expect(page.locator('[data-testid="dasha-period"]')).toHaveCount(9);
    watcher.assertClean();
  });
}

test("horoscope report: saves only derived profile fields", async ({ page }) => {
  await calculateReport(page, "en");
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain(DICTS.en.ui.profileLabelPrompt);
    await dialog.accept("Report profile");
  });
  await page.getByRole("button", { name: DICTS.en.horoscopeReport.saveProfile }).click();
  await expect(page.getByRole("button", { name: DICTS.en.horoscopeReport.profileSaved })).toBeVisible();
  const raw = await page.evaluate(() => window.localStorage.getItem("ff_saved_profiles"));
  expect(raw).toContain("nakshatra_index");
  expect(raw).toContain("paksha");
  expect(raw).toContain("moon_rashi_index");
  expect(raw).not.toContain("birth_date");
  expect(raw).not.toContain("birth_time");
  expect(raw).not.toContain("latitude");
  expect(raw).not.toContain("longitude");
});

test("horoscope report: share action keeps birth data in POST body only", async ({ page }) => {
  const watcher = watchForBirthDataInUrls(page);
  let payload: unknown = null;
  await page.route("**/api/share-horoscope-report", async (route) => {
    payload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
      ]),
    });
  });
  await calculateReport(page, "en");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: DICTS.en.horoscopeReport.shareReportImage }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^horoscope-report-\d{4}-\d{2}-\d{2}\.png$/);
  expect(JSON.stringify(payload)).toContain("birth_date");
  expect(JSON.stringify(payload)).toContain("birth_time");
  watcher.assertClean();
});

test("horoscope report: print media hides controls and keeps report content", async ({ page }) => {
  await calculateReport(page, "en");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator('[data-testid="horoscope-report-controls"]')).toBeHidden();
  await expect(page.locator('[data-testid="horoscope-report-result"]')).toBeVisible();
  await expect(page.locator('[data-testid="horoscope-report-chart"]')).toBeVisible();
});

test("horoscope report: landing card, nav link, and sitemap are present", async ({ page, request }) => {
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(DICTS.en.features.horoscopeReport.title) }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: DICTS.en.nav.horoscopeReport }).first().click();
  await expect(page).toHaveURL(/\/en\/horoscope-report$/);

  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/horoscope-report");
  expect(body).toContain("/si/horoscope-report");
});

test("@mobile horoscope report keeps Sinhala layout within 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await calculateReport(page, "si");
  await expect(page.locator('[data-testid="horoscope-report-summary"]')).toBeVisible();
  const hasHScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth + 5);
  expect(hasHScroll).toBe(false);
});

test("share-horoscope-report route returns PNG and rejects invalid request bodies", async ({ request }) => {
  const body = {
    locale: "si",
    birth: {
      birth_date: "2000-01-01",
      birth_time: "12:00:00",
      location_name: "Colombo",
      latitude: 6.9271,
      longitude: 79.8612,
      iana_tz: "Asia/Colombo",
    },
  };
  const ok = await request.post("/api/share-horoscope-report", { data: body });
  expect(ok.ok()).toBe(true);
  expect(ok.headers()["content-type"]).toContain("image/png");

  const badLocale = await request.post("/api/share-horoscope-report", {
    data: { ...body, locale: "ta" },
  });
  expect(badLocale.status()).toBe(422);

  const badBirth = await request.post("/api/share-horoscope-report", {
    data: { locale: "en", birth: { ...body.birth, latitude: 999 } },
  });
  expect(badBirth.status()).toBe(422);
});
