import { test, expect } from "@playwright/test";
import { DICTS, openCalculator, watchForBirthDataInUrls } from "./helpers";

const CARD_BODY = {
  method: "bird",
  bird: "peacock",
  target_date: new Date().toISOString().slice(0, 10),
  target_time: "12:00:00",
  location_name: "Colombo",
  latitude: 6.9271,
  longitude: 79.8612,
  iana_tz: "Asia/Colombo",
};

test("print emulation: only the sheet is visible; full mode shows 50 sub rows", async ({ page }) => {
  await openCalculator(page, "en");
  await page.emulateMedia({ media: "print" });

  const sheet = page.locator("#print-sheet");
  await expect(sheet).toBeVisible();
  // The interactive app must not print: the calculate tabs are hidden.
  await expect(page.getByRole("tab", { name: /direct bird/i })).not.toBeVisible();
  // Full detail (the default): 10 major group rows + 50 sub rows.
  await expect(sheet.locator("tbody tr")).toHaveCount(60);
  // Sheet header carries the essentials.
  await expect(sheet.getByText(DICTS.en.platform.name)).toBeVisible();
});

test("print emulation major-only mode: 10 rows, no sub-period columns", async ({ page }) => {
  await openCalculator(page, "en");
  // Untick "Include sub-periods" -> major-only exports.
  await page.getByLabel(DICTS.en.ui.includeSubPeriods).uncheck();
  await page.emulateMedia({ media: "print" });

  const sheet = page.locator("#print-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator("tbody tr")).toHaveCount(10);
  await expect(sheet.getByText(DICTS.en.ui.subBird)).not.toBeVisible();
});

test("print sheet renders Sinhala", async ({ page }) => {
  await openCalculator(page, "si");
  await page.emulateMedia({ media: "print" });
  const sheet = page.locator("#print-sheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText(DICTS.si.platform.name)).toBeVisible();
  await expect(sheet.getByText(DICTS.si.ui.daytime).first()).toBeVisible();
});

for (const [detail, locale] of [
  ["major", "en"],
  ["full", "si"],
] as const) {
  test(`share-card route returns a PNG (${detail}/${locale})`, async ({ request }) => {
    const res = await request.post("/api/share-card", {
      data: { ...CARD_BODY, detail, locale },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    const body = await res.body();
    // PNG magic bytes.
    expect(body.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    expect(body.length).toBeGreaterThan(20_000);
  });
}

test("share-card route rejects bad detail and bad schedule body", async ({ request }) => {
  const bad1 = await request.post("/api/share-card", {
    data: { ...CARD_BODY, detail: "everything", locale: "en" },
  });
  expect(bad1.status()).toBe(422);
  const bad2 = await request.post("/api/share-card", {
    data: { method: "bird", bird: "dragon", detail: "major", locale: "en" },
  });
  expect(bad2.status()).toBe(422);
});

test("share image button downloads the PNG; no location data in URLs", async ({ page }) => {
  await openCalculator(page, "en");
  const watcher = watchForBirthDataInUrls(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("share-image").click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^pancha-pakshi-\d{4}-\d{2}-\d{2}-[a-z]+\.png$/);
  watcher.assertClean();
});
