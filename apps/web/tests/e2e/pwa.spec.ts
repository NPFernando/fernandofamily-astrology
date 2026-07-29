import { test, expect } from "@playwright/test";
import { DICTS } from "./helpers";

async function dispatchInstallPrompt(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted" }>;
    };
    event.prompt = async () => {
      window.localStorage.setItem("ff_install_prompt_test", "prompted");
    };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
}

test("manifest advertises installable PNG and maskable app icons", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();

  expect(manifest).toMatchObject({
    display: "standalone",
    start_url: "/",
    scope: "/",
    theme_color: "#b45309",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ src: "/icons/app/icon-192.png", sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ src: "/icons/app/icon-512.png", sizes: "512x512", purpose: "any" }),
      expect.objectContaining({ src: "/icons/app/icon-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
    ]),
  );

  for (const icon of manifest.icons) {
    const response = await request.get(icon.src);
    expect(response.ok(), `${icon.src} should be served`).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("service worker precaches only the fast offline shell", async ({ request }) => {
  const response = await request.get("/sw.js");
  expect(response.ok()).toBe(true);
  const worker = await response.text();

  for (const asset of ["/en", "/si", "/icons/app/icon-192.png", "/icons/apple-touch-icon.png", "/manifest.webmanifest"]) {
    expect(worker).toContain(asset);
  }
  const precacheSection = worker.slice(worker.indexOf("const PRECACHE_URLS"), worker.indexOf('self.addEventListener("install"'));
  expect(precacheSection).not.toContain('"/posters/');
  expect(precacheSection).not.toContain('"/icons/generated/');
  expect(worker).toContain("POSTER_CACHE_NAME");
  expect(worker).toContain("MAX_POSTER_ENTRIES = 96");
});

test("responsive posters advertise a cache-friendly HTTP policy", async ({ request }) => {
  const poster = await request.get("/posters/landing-heritage-v2-480.avif");
  expect(poster.ok()).toBe(true);
  expect(poster.headers()["cache-control"]).toContain("max-age=86400");
  expect(poster.headers()["cache-control"]).toContain("stale-while-revalidate=604800");
});

test("service worker provides the matching locale shell while offline", async ({ page, context }) => {
  await page.goto("/en");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  try {
    const [english, sinhala] = await page.evaluate(async () => {
      const offlinePage = async (path: string) => {
        const response = await fetch(path);
        return { status: response.status, body: await response.text() };
      };
      return Promise.all([offlinePage("/en/offline-check"), offlinePage("/si/offline-check")]);
    });

    expect(english.status).toBe(200);
    expect(english.body).toContain('<html lang="en"');
    expect(sinhala.status).toBe(200);
    expect(sinhala.body).toContain('<html lang="si"');
  } finally {
    await context.setOffline(false);
  }
});

test("install prompt button calls the deferred browser prompt", async ({ page }) => {
  await page.goto("/en");

  const install = page.getByTestId("install-app");
  await expect(async () => {
    await dispatchInstallPrompt(page);
    await expect(install).toBeVisible({ timeout: 500 });
  }).toPass({ timeout: 10_000 });
  await expect(install).toHaveAttribute("aria-label", DICTS.en.ui.installApp);

  await install.click();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("ff_install_prompt_test")))
    .toBe("prompted");
  await expect(install).toBeHidden();
});

test("@mobile iOS Safari shows localized install guidance", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:3199",
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    viewport: { width: 360, height: 740 },
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto("/si");

  await page.getByTestId("install-app").click();
  const guide = page.getByTestId("install-guide");
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("heading", { name: DICTS.si.ui.installGuideTitle })).toBeVisible();
  await expect(guide.getByText(DICTS.si.ui.installIosStepShare)).toBeVisible();
  await context.close();
});

test("standalone display mode hides install affordance", async ({ page }) => {
  await page.addInitScript(() => {
    const realMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string): MediaQueryList => {
      if (query !== "(display-mode: standalone)") return realMatchMedia(query);
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    };
  });

  await page.goto("/en");
  await dispatchInstallPrompt(page);
  await expect(page.getByTestId("install-app")).toHaveCount(0);
});
