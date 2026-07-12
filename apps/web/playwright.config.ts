import { defineConfig, devices } from "@playwright/test";

// E2E suite: real browser against the production build (`next start`) and
// the real FastAPI backend (apps/api/.venv must exist — see apps/api README).
// Run with `pnpm e2e` (which builds first — rewrites bake API_PROXY_TARGET
// at build time, so the build must happen with the E2E port env too).
const WEB_PORT = 3199;
const API_PORT = 8199;

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
  ],
});
