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
