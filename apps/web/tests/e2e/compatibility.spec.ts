import { test, expect, type Page } from "@playwright/test";
import { DICTS, watchForBirthDataInUrls, type LocaleKey } from "./helpers";

async function openCompatibility(page: Page, locale: LocaleKey) {
  await page.goto(`/${locale}/compatibility`);
  await expect(page.locator('[data-testid="compatibility-result"]')).toBeVisible({
    timeout: 30_000,
  });
}

for (const locale of ["en", "si"] as const) {
  test(`compatibility (${locale}): zero-click direct bird comparison`, async ({ page }) => {
    const watcher = watchForBirthDataInUrls(page);
    await openCompatibility(page, locale);
    const dict = DICTS[locale];
    await expect(page.getByRole("heading", { name: dict.compatibility.title })).toBeVisible();
    await expect(page.locator('[data-testid="compatibility-result"]')).toContainText(
      dict.enums.relations.friend,
      { timeout: 30_000 },
    );
    await expect(page.locator('[data-testid="compatibility-variants"]')).toContainText("280");
    watcher.assertClean();
  });
}

test("compatibility: selecting a context-dependent pair updates variants", async ({ page }) => {
  await openCompatibility(page, "en");
  const dict = DICTS.en;
  await page
    .getByRole("button", { name: `${dict.compatibility.secondBird}: ${dict.enums.birds.owl}` })
    .click();
  await expect(page.locator('[data-testid="compatibility-context-dependent"]')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator('[data-testid="compatibility-variants"]')).toContainText(
    dict.enums.relations.enemy,
  );
  await expect(page.locator('[data-testid="compatibility-variants"]')).toContainText(
    dict.enums.relations.friend,
  );
  await expect(page.locator('[data-testid="compatibility-variants"]')).toContainText("70");
  await expect(page.locator('[data-testid="compatibility-variants"]')).toContainText("210");
});

test("compatibility: nav link, landing card, and sitemap are present", async ({
  page,
  request,
}) => {
  const dict = DICTS.en;
  await page.goto("/en");
  await expect(
    page.getByRole("link", { name: new RegExp(dict.features.compatibility.title) }).first(),
  ).toBeVisible();
  await page.goto("/en/compatibility");
  await expect(page.locator('[data-testid="compatibility-result"]')).toBeVisible({
    timeout: 30_000,
  });

  const res = await request.get("/sitemap.xml");
  const body = await res.text();
  expect(body).toContain("/en/compatibility");
  expect(body).toContain("/si/compatibility");
});

test("@mobile compatibility at 360px without horizontal scroll", async ({ page }) => {
  await openCompatibility(page, "en");
  await expect(page.locator('[data-testid="compatibility-result"]')).toBeVisible();
  const hasHScroll = await page.evaluate(
    () => document.body.scrollWidth > window.innerWidth + 5,
  );
  expect(hasHScroll).toBe(false);
});
