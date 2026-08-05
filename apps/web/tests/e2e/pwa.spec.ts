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

async function mockServiceWorker(
  page: import("@playwright/test").Page,
  { online = true, hasController = false, hasWaitingWorker = false } = {},
) {
  await page.addInitScript(
    ({ initialOnline, initialHasController, initialHasWaitingWorker }) => {
      type PwaTestWindow = Window & {
        __pwaOnline: boolean;
        __pwaMessages: unknown[];
      };
      const testWindow = window as unknown as PwaTestWindow;
      testWindow.__pwaOnline = initialOnline;
      testWindow.__pwaMessages = [];

      Object.defineProperty(navigator, "onLine", {
        configurable: true,
        get: () => testWindow.__pwaOnline,
      });

      const waitingWorker = initialHasWaitingWorker
        ? {
            postMessage: (message: unknown) => testWindow.__pwaMessages.push(message),
          }
        : null;
      const registration = Object.assign(new EventTarget(), {
        waiting: waitingWorker,
        installing: null,
      });
      const serviceWorker = Object.assign(new EventTarget(), {
        controller: initialHasController ? {} : null,
        register: async () => registration,
      });
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: serviceWorker,
      });
    },
    {
      initialOnline: online,
      initialHasController: hasController,
      initialHasWaitingWorker: hasWaitingWorker,
    },
  );
}

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

test("global offline status clears when the connection returns", async ({ page }) => {
  await mockServiceWorker(page, { online: false });
  await page.goto("/en");

  const status = page.getByTestId("pwa-offline-status");
  await expect(status).toBeVisible();
  await expect(status).toContainText(DICTS.en.ui.offlineAppNotice);

  await page.evaluate(() => {
    (window as unknown as Window & { __pwaOnline: boolean }).__pwaOnline = true;
    window.dispatchEvent(new Event("online"));
  });
  await expect(status).toBeHidden();
});

test("waiting update activates only after the visitor refreshes", async ({ page }) => {
  await mockServiceWorker(page, { hasController: true, hasWaitingWorker: true });
  await page.goto("/en");

  const update = page.getByTestId("pwa-update-ready");
  await expect(update).toBeVisible();
  await expect(update).toContainText(DICTS.en.ui.updateAvailable);
  await update.getByRole("button", { name: DICTS.en.ui.refresh, exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Window & { __pwaMessages: unknown[] }).__pwaMessages))
    .toEqual([{ type: "SKIP_WAITING" }]);
});

test("first install does not show an update prompt", async ({ page }) => {
  await mockServiceWorker(page, { hasWaitingWorker: true });
  await page.goto("/en");
  await expect(page.getByTestId("pwa-update-ready")).toHaveCount(0);
});
