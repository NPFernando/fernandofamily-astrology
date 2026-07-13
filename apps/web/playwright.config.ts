import { readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// E2E suite: real browser against the production build (`next start`) and
// the real FastAPI backend (apps/api/.venv must exist — see apps/api README).
// Run with `pnpm e2e` (which builds first — rewrites bake API_PROXY_TARGET
// at build time, so the build must happen with the E2E port env too).
const WEB_PORT = 3199;
const API_PORT = 8199;
// A second `next start` of the SAME build with throwaway VAPID keys in its
// env — the push flag is read at request time, so one build serves both the
// "push off" (3199) and "push on" (3197) servers. push.spec.ts targets the
// push port explicitly; every other spec keeps the flag-off baseURL.
const PUSH_WEB_PORT = 3197;

const vapidKeys = webpush.generateVAPIDKeys();

// The push-enabled server gets the astrology DB when the repo .env has one
// (host-side connections use 127.0.0.1, not the container-only
// host.docker.internal alias). Without it, subscribe answers a clean 503 —
// push.spec.ts accepts either outcome and reports which ran.
function astrologyDbUrl(): string {
  try {
    const env = readFileSync("../../.env", "utf8");
    const m = env.match(/^ASTROLOGY_DATABASE_URL=(.+)$/m);
    return m ? m[1].trim().replace("host.docker.internal", "127.0.0.1") : "";
  } catch {
    return "";
  }
}

export const PUSH_E2E = {
  baseURL: `http://127.0.0.1:${PUSH_WEB_PORT}`,
  dispatchKey: "e2e-dispatch-key",
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // shared next start instance; specs are fast enough serially
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile-360",
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 } },
      grep: /@mobile/,
    },
  ],
  webServer: [
    {
      command: `bash -c "cd ../api && .venv/bin/uvicorn app.main:app --port ${API_PORT}"`,
      url: `http://127.0.0.1:${API_PORT}/api/v1/health/live`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `pnpm start --port ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}/en`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
    },
    {
      command: `pnpm start --port ${PUSH_WEB_PORT}`,
      url: `http://127.0.0.1:${PUSH_WEB_PORT}/en`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
        VAPID_PUBLIC_KEY: vapidKeys.publicKey,
        VAPID_PRIVATE_KEY: vapidKeys.privateKey,
        VAPID_SUBJECT: "mailto:e2e@example.com",
        INTERNAL_DISPATCH_KEY: PUSH_E2E.dispatchKey,
        ASTROLOGY_DATABASE_URL: astrologyDbUrl(),
      },
    },
  ],
});
