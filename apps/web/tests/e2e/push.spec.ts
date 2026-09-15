import { test, expect } from "@playwright/test";
import { PUSH_E2E } from "../../playwright.config";
import { removePushSubscription } from "../../lib/push-subscription";
import { openToolsContext } from "./helpers";

// Flag-off behavior runs against the default (no-VAPID) server via baseURL;
// everything push-enabled targets PUSH_E2E.baseURL — a second `next start`
// of the same build with throwaway VAPID keys (see playwright.config.ts).

test("failed server deletion retains the browser subscription for retry", async () => {
  let browserSubscriptionRemoved = false;
  const removed = await removePushSubscription(
    "https://push.example/device-1",
    async () => {
      browserSubscriptionRemoved = true;
      return true;
    },
    async () => ({ ok: false, json: async () => ({ error: "storage_unavailable" }) }),
  );

  expect(removed).toBe(false);
  expect(browserSubscriptionRemoved).toBe(false);
});

test("successful server deletion then removes the browser subscription", async () => {
  let requestedEndpoint: string | undefined;
  let browserSubscriptionRemoved = false;
  const removed = await removePushSubscription(
    "https://push.example/device-2",
    async () => {
      browserSubscriptionRemoved = true;
      return true;
    },
    async (_input, init) => {
      requestedEndpoint = JSON.parse(String(init?.body)).endpoint;
      return { ok: true, json: async () => ({ unsubscribed: true }) };
    },
  );

  expect(removed).toBe(true);
  expect(requestedEndpoint).toBe("https://push.example/device-2");
  expect(browserSubscriptionRemoved).toBe(true);
});

test.describe("push disabled (default server)", () => {
  test("public-key 404s and the opt-in card is absent", async ({ page, request }) => {
    const res = await request.get("/api/push/public-key");
    expect(res.status()).toBe(404);

    await page.goto("/en/pancha-pakshi");
    // Zero-click computes a schedule; the opt-in card must still not appear.
    await expect(page.getByText("Time remaining")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Period alerts")).toHaveCount(0);
  });
});

test.describe("push enabled (VAPID server)", () => {
  test("public-key serves the key", async ({ request }) => {
    const res = await request.get(`${PUSH_E2E.baseURL}/api/push/public-key`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(typeof data.key).toBe("string");
    expect(data.key.length).toBeGreaterThan(20);
  });

  test("opt-in card renders with its settings", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: PUSH_E2E.baseURL,
      permissions: ["notifications"],
    });
    const page = await context.newPage();
    await page.goto("/en/pancha-pakshi");
    await expect(page.getByText("Time remaining")).toBeVisible({ timeout: 15_000 });

    const tools = await openToolsContext(page);
    const card = tools.getByText("Period alerts");
    await expect(card).toBeVisible();
    await card.click(); // expand the <details>
    await expect(page.getByRole("button", { name: "Enable alerts" })).toBeVisible();
    await expect(page.getByText("Alert lead time")).toBeVisible();
    await expect(page.getByText(/push address.*rounded to roughly 1 km/i)).toBeVisible();
    await context.close();
    // The real pushManager.subscribe can't complete in headless Chromium
    // (no push service is available in the sandbox) — the route itself is
    // exercised directly in the next test instead.
  });

  test("subscribe route validates and round-trips", async ({ request }) => {
    const url = `${PUSH_E2E.baseURL}/api/push/subscribe`;
    const endpoint = `https://updates.push.services.example/e2e/${Date.now()}`;

    // Invalid: missing keys → 422.
    const bad = await request.post(url, {
      data: { subscription: { endpoint }, bird: "peacock", latitude: 6.9, longitude: 79.8, iana_tz: "Asia/Colombo" },
    });
    expect(bad.status()).toBe(422);

    // Database persistence is asserted only when an explicitly configured,
    // isolated E2E database is present. No production .env fallback exists.
    const good = await request.post(url, {
      data: {
        subscription: { endpoint, keys: { p256dh: "e2e-p256dh-key", auth: "e2e-auth" } },
        bird: "peacock",
        latitude: 6.92708,
        longitude: 79.86124,
        iana_tz: "Asia/Colombo",
        min_effect: "very_good",
        lead_minutes: 10,
        locale: "en",
      },
    });
    if (PUSH_E2E.databaseEnabled) {
      expect(good.status()).toBe(200);
    } else {
      expect(good.status()).toBe(503);
    }

    if (good.status() === 200) {
      // Clean up the test row.
      const del = await request.post(`${PUSH_E2E.baseURL}/api/push/unsubscribe`, {
        data: { endpoint },
      });
      expect(del.status()).toBe(200);
    }
  });

  test("dispatch requires the internal key", async ({ request }) => {
    const url = `${PUSH_E2E.baseURL}/api/internal/push-dispatch?dry=1`;

    const noKey = await request.post(url);
    expect(noKey.status()).toBe(401);

    const wrongKey = await request.post(url, { headers: { "x-internal-key": "nope" } });
    expect(wrongKey.status()).toBe(401);

    const ok = await request.post(url, { headers: { "x-internal-key": PUSH_E2E.dispatchKey } });
    // 200 with the explicitly isolated DB (shape-checked), clean 503 without it.
    expect(ok.status()).toBe(PUSH_E2E.databaseEnabled ? 200 : 503);
    if (ok.status() === 200) {
      const data = await ok.json();
      expect(data.dry).toBe(true);
      expect(Array.isArray(data.would_send)).toBe(true);
      for (const entry of data.would_send) {
        // Dry-run output must never contain raw endpoints.
        expect(entry.endpoint_hash).toMatch(/^[0-9a-f]{12}$/);
        expect(JSON.stringify(entry)).not.toContain("https://");
      }
    }
  });
});
