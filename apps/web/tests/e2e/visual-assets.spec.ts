import { expect, test } from "@playwright/test";
import { DICTS } from "./helpers";

const FEATURES = [
  "birth-nakshatra",
  "pancha-pakshi",
  "panchanga",
  "moon-calendar",
  "daily-guide",
  "muhurta",
  "compatibility",
  "divisional-charts",
  "porondam",
  "birth-chart",
  "dasha",
] as const;

test("landing page uses generated hero, feature posters, and nonblank icons", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: DICTS.en.platform.name })).toBeVisible();

  const visualState = await page.evaluate((features) => {
    const images = [...document.images].map((img) => ({
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      dataIcon: img.getAttribute("data-icon"),
    }));
    return {
      hasHero: images.some((img) => img.src.includes("landing-almanac")),
      posterCount: images.filter((img) => img.src.includes("/posters/features/") || img.src.includes("%2Fposters%2Ffeatures%2F")).length,
      missingIcons: features.filter((feature) => !images.some((img) => img.dataIcon === feature && img.naturalWidth > 0 && img.naturalHeight > 0)),
      brokenImages: images.filter((img) => img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)).map((img) => img.src),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, FEATURES);

  expect(visualState.hasHero).toBe(true);
  expect(visualState.posterCount).toBeGreaterThanOrEqual(FEATURES.length);
  expect(visualState.missingIcons).toEqual([]);
  expect(visualState.brokenImages).toEqual([]);
  expect(visualState.overflow).toBeLessThanOrEqual(2);
});

test("generated feature assets and per-page OG images are served", async ({ page, request }) => {
  for (const feature of FEATURES) {
    const icon = await request.get(`/icons/generated/features/${feature}-64.png`);
    expect(icon.ok(), `${feature} icon`).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");

    const poster = await request.get(`/posters/features/${feature}.webp`);
    expect(poster.ok(), `${feature} poster`).toBe(true);
    expect(poster.headers()["content-type"]).toContain("image/webp");

    const og = await request.get(`/og/${feature}.png`);
    expect(og.ok(), `${feature} OG image`).toBe(true);
    expect(og.headers()["content-type"]).toContain("image/png");

    await page.goto(`/en/${feature}`);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toContain(`/og/${feature}.png`);
  }
});

test("@mobile landing generated visuals fit at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/si");
  await expect(page.getByRole("heading", { name: DICTS.si.platform.name })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
});
