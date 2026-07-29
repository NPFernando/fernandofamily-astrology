import { expect, test } from "@playwright/test";
import { DICTS } from "./helpers";

const FEATURES = [
  "birth-nakshatra",
  "pancha-pakshi",
  "panchanga",
  "moon-calendar",
  "daily-guide",
  "family-almanac",
  "muhurta",
  "compatibility",
  "divisional-charts",
  "porondam",
  "birth-chart",
  "horoscope-report",
  "dasha",
  "ashtakavarga",
] as const;

test("landing page uses generated hero, feature posters, and nonblank icons", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: DICTS.en.platform.name })).toBeVisible();
  await expect
    .poll(() => page.locator('[data-deferred-poster="ready"] picture').count())
    .toBe(FEATURES.length - 1);

  const visualState = await page.evaluate((features) => {
    const images = [...document.images].map((img) => ({
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      dataIcon: img.getAttribute("data-icon"),
    }));
    return {
      hasHero: images.some((img) => img.src.includes("landing-heritage-v2")),
      posterCount: images.filter((img) => img.src.includes("/posters/features/") || img.src.includes("%2Fposters%2Ffeatures%2F")).length,
      missingIcons: features.filter((feature) => !document.querySelector(`[data-icon="${feature}"]`)),
      brokenImages: images.filter((img) => img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)).map((img) => img.src),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, FEATURES);

  expect(visualState.hasHero).toBe(true);
  expect(visualState.posterCount).toBeGreaterThanOrEqual(FEATURES.length);
  expect(visualState.missingIcons).toEqual([]);
  expect(visualState.brokenImages).toEqual([]);
  expect(visualState.overflow).toBeLessThanOrEqual(2);

  await expect(page.locator('picture > source[type="image/avif"]')).toHaveCount(FEATURES.length + 1);
  await expect(page.locator('picture > source[type="image/avif"]').first()).toHaveAttribute("srcset", /-480\.avif 480w, .*?-960\.avif 960w, .*?-1440\.avif 1440w, .*\.avif 1920w/);
  const posterFallbacks = page.locator('picture > source[type="image/webp"]');
  await expect(posterFallbacks).toHaveCount(FEATURES.length + 1);
  await expect(page.locator("picture > img").first()).toHaveAttribute("src", /\.jpg$/);
});

test("landing posters retain their visual baseline when JPEG fallback is selected", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: DICTS.en.platform.name })).toBeVisible();
  await expect(page.locator(".hero-dawn")).toHaveScreenshot("landing-posters-modern.png", { animations: "disabled" });

  await page.locator('picture > source[type="image/avif"], picture > source[type="image/webp"]').evaluateAll((sources) => {
    for (const source of sources) source.setAttribute("type", "image/webp-disabled");
  });

  await expect
    .poll(() => page.locator("picture > img").evaluateAll((images) => images.map((image) => (image as HTMLImageElement).currentSrc.endsWith(".jpg"))))
    .toEqual(Array(FEATURES.length + 1).fill(true));
  await expect(page.locator(".hero-dawn")).toHaveScreenshot("landing-posters-jpeg-fallback.png", { animations: "disabled" });
});

test("low-data mode persists and omits landing poster markup", async ({ page }) => {
  await page.goto("/en");
  await page.getByTestId("display-preferences").click();
  const toggle = page.getByRole("button", { name: DICTS.en.ui.enableLowDataMode });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await page.getByTestId("display-preferences").click();
  await expect(page.getByRole("button", { name: DICTS.en.ui.disableLowDataMode })).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => document.cookie.includes("ff_low_data=1")))
    .toBe(true);

  await page.reload();
  const content = await page.content();
  expect(content).not.toContain("landing-heritage-v2.webp");
  expect(content).not.toContain("/posters/features/");
  expect(content).not.toContain("/icons/generated/birds/");
});

test("slow connections omit below-the-fold decorative posters", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "2g", saveData: false },
    });
  });
  await page.goto("/en");
  await expect(page.getByRole("heading", { name: DICTS.en.platform.name })).toBeVisible();
  const deferred = page.locator("[data-deferred-poster]");
  await expect(deferred).toHaveCount(FEATURES.length - 1);
  await expect
    .poll(() => deferred.evaluateAll((elements) => elements.map((element) => element.getAttribute("data-deferred-poster"))))
    .toEqual(Array(FEATURES.length - 1).fill("suppressed"));
  await expect(deferred.locator("picture")).toHaveCount(0);
  const firstDeferred = deferred.first();
  const reveal = firstDeferred.getByRole("button", { name: DICTS.en.ui.revealDecorativeImages });
  await reveal.click();
  await expect(reveal).toBeHidden();
  await expect(firstDeferred).toHaveAttribute("data-deferred-poster", "ready");
  await expect(firstDeferred.locator("picture")).toHaveCount(1);
});

test("always-show-images preference overrides automatic slow-network deferral", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { effectiveType: "2g", saveData: false },
    });
  });
  await page.goto("/en");
  await page.getByTestId("display-preferences").click();
  const preference = page.getByRole("button", { name: DICTS.en.ui.alwaysShowImages });
  await preference.click();
  await page.getByTestId("display-preferences").click();
  await expect(page.getByRole("button", { name: DICTS.en.ui.useAutomaticImages })).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.locator('[data-deferred-poster="ready"] picture').count())
    .toBe(FEATURES.length - 1);
  await expect(page.locator('[data-deferred-poster="suppressed"]')).toHaveCount(0);
});

test("image telemetry endpoint accepts only bounded anonymous aggregates", async ({ request }) => {
  const accepted = await request.post("/api/telemetry/image-load", {
    data: { outcome: "loaded", transferBucket: "under-100kb", count: 2 },
  });
  expect(accepted.status()).toBe(204);
  expect(accepted.headers()["cache-control"]).toContain("no-store");

  const exportWithoutToken = await request.get("/api/telemetry/image-load");
  expect(exportWithoutToken.status()).toBe(404);

  const rejected = await request.post("/api/telemetry/image-load", {
    data: { outcome: "loaded", transferBucket: "https://example.test/poster.avif", count: 99 },
  });
  expect(rejected.status()).toBe(204);
});

test("mobile birth-nakshatra navigation does not shift the main content", async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 823 });
  await page.addInitScript(() => {
    (window as Window & { __ffCls?: number }).__ffCls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEntryList) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) (window as Window & { __ffCls?: number }).__ffCls! += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("/en/birth-nakshatra", { waitUntil: "networkidle" });
  await page.waitForTimeout(1_000);
  expect(await page.evaluate(() => (window as Window & { __ffCls?: number }).__ffCls)).toBeLessThanOrEqual(0.1);
});

test("mobile header and display preferences retain their visual baseline", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/en");
  const header = page.locator("header[data-app-shell]");
  await expect(header).toHaveScreenshot("mobile-header.png", { animations: "disabled" });
  await page.getByTestId("display-preferences").click();
  await expect(header).toHaveScreenshot("mobile-display-preferences.png", { animations: "disabled" });
});

test("tool controls retain their dark-mode visual baseline", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("ff_theme", "dark");
  });
  await page.goto("/en/birth-chart");
  await expect(page.locator('[data-testid="birth-chart-controls"]')).toHaveScreenshot("birth-chart-controls-dark.png", { animations: "disabled" });
  await page.goto("/en/horoscope-report");
  await expect(page.locator('[data-testid="horoscope-report-controls"]')).toHaveScreenshot("horoscope-report-controls-dark.png", { animations: "disabled" });
});

test("generated feature assets and per-page OG images are served", async ({ page, request }) => {
  for (const feature of FEATURES) {
    const icon = await request.get(`/icons/generated/features/${feature}-64.png`);
    expect(icon.ok(), `${feature} icon`).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");

    const poster = await request.get(`/posters/features/${feature}.webp`);
    expect(poster.ok(), `${feature} poster`).toBe(true);
    expect(poster.headers()["content-type"]).toContain("image/webp");

    const posterAvif = await request.get(`/posters/features/${feature}.avif`);
    expect(posterAvif.ok(), `${feature} AVIF variant`).toBe(true);
    expect(posterAvif.headers()["content-type"]).toContain("image/avif");

    for (const width of [480, 960, 1440]) {
      for (const format of ["avif", "webp", "jpg"]) {
        const responsivePoster = await request.get(`/posters/features/${feature}-${width}.${format}`);
        expect(responsivePoster.ok(), `${feature} ${width}px ${format}`).toBe(true);
      }
    }

    const posterFallback = await request.get(`/posters/features/${feature}.jpg`);
    expect(posterFallback.ok(), `${feature} JPEG fallback`).toBe(true);
    expect(posterFallback.headers()["content-type"]).toContain("image/jpeg");

    const og = await request.get(`/og/${feature}.png`);
    expect(og.ok(), `${feature} OG image`).toBe(true);
    expect(og.headers()["content-type"]).toContain("image/png");

    await page.goto(`/en/${feature}`);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toContain(`/og/${feature}.png`);
  }

  const heroAvif = await request.get("/posters/landing-heritage-v2.avif");
  expect(heroAvif.ok(), "landing AVIF variant").toBe(true);
  expect(heroAvif.headers()["content-type"]).toContain("image/avif");

  for (const width of [480, 960, 1440]) {
    for (const format of ["avif", "webp", "jpg"]) {
      const responsiveHero = await request.get(`/posters/landing-heritage-v2-${width}.${format}`);
      expect(responsiveHero.ok(), `landing ${width}px ${format}`).toBe(true);
    }
  }

  const heroFallback = await request.get("/posters/landing-heritage-v2.jpg");
  expect(heroFallback.ok(), "landing JPEG fallback").toBe(true);
  expect(heroFallback.headers()["content-type"]).toContain("image/jpeg");
});

for (const [locale, openGraphLocale] of [
  ["en", "en_US"],
  ["si", "si_LK"],
] as const) {
  test(`localized social preview metadata is complete for ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/birth-nakshatra`);
    const metadata = DICTS[locale].metadata.birthNakshatra;
    const title = metadata.title ?? DICTS[locale].platform.name;

    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", title);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", metadata.description);
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", openGraphLocale);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", new RegExp(`/${locale}/birth-nakshatra$`));
    await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", title);
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", metadata.description);
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", `${title} | ${DICTS[locale].platform.name}`);
  });
}

test("grouped navigation exposes the daily tools without a long link rail", async ({ page }) => {
  await page.goto("/en");
  const todayGroup = page.locator("summary").filter({ hasText: DICTS.en.ui.todayTools });
  await expect(todayGroup).toBeVisible();
  await todayGroup.press("Enter");

  const dailyGuide = page.getByRole("link", { name: DICTS.en.nav.dailyGuide, exact: true });
  await expect(dailyGuide).toBeVisible();
  await dailyGuide.click();
  await expect(page).toHaveURL(/\/en\/daily-guide$/);
});

test("@mobile navigation drawer opens grouped routes and closes with Escape", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/en");

  const menuButton = page.getByRole("button", { name: DICTS.en.ui.menu, exact: true });
  await menuButton.click();
  await expect(page.getByRole("link", { name: DICTS.en.nav.dailyGuide, exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: DICTS.en.nav.dailyGuide, exact: true })).toBeHidden();
});

test("@mobile landing generated visuals fit at 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/si");
  await expect(page.getByRole("heading", { name: DICTS.si.platform.name })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth))
    .toBeLessThanOrEqual(2);
  await expect
    .poll(() => page.locator(".hero-dawn > picture > img").evaluate((image) => (image as HTMLImageElement).currentSrc))
    .toContain("landing-heritage-v2-480.avif");
});
