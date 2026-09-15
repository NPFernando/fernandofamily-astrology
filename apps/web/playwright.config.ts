import { defineConfig, devices } from "@playwright/test";
import webpush from "web-push";

// E2E suite: real browser against the production standalone build and
// the real FastAPI backend (apps/api/.venv must exist — see apps/api README).
// Run with `pnpm e2e` (which builds first — rewrites bake API_PROXY_TARGET
// at build time, so the build must happen with the E2E port env too).
const WEB_PORT = 3199;
const API_PORT = 8199;
// A second standalone server of the SAME build with throwaway VAPID keys in its
// env — the push flag is read at request time, so one build serves both the
// "push off" (3199) and "push on" (3197) servers. push.spec.ts targets the
// push port explicitly; every other spec keeps the flag-off baseURL.
const PUSH_WEB_PORT = 3197;
const E2E_AUTH_SECRET = "isolated-e2e-only-auth-secret-not-for-deployment";
const SESSION_COOKIE = "authjs.session-token";

const vapidKeys = webpush.generateVAPIDKeys();

// Never inherit the repository/runtime database configuration for browser
// tests. Persistence coverage is opt-in and restricted to a disposable,
// loopback-only database with a dedicated role and database name.
function astrologyE2eDbUrl(): string {
  const raw = process.env.ASTROLOGY_E2E_DATABASE_URL?.trim();
  if (!raw) return "";

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("ASTROLOGY_E2E_DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("ASTROLOGY_E2E_DATABASE_URL must use PostgreSQL");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error("ASTROLOGY_E2E_DATABASE_URL must target loopback only");
  }
  if (decodeURIComponent(parsed.username) !== "astrology_e2e_app" || parsed.pathname !== "/astrology_e2e") {
    throw new Error("ASTROLOGY_E2E_DATABASE_URL must use astrology_e2e_app@astrology_e2e");
  }
  return raw;
}

const e2eDbUrl = astrologyE2eDbUrl();

export const PUSH_E2E = {
  baseURL: `http://127.0.0.1:${PUSH_WEB_PORT}`,
  dispatchKey: "e2e-dispatch-key",
  databaseEnabled: Boolean(e2eDbUrl),
};

export const AUTH_E2E = {
  cookieName: SESSION_COOKIE,
  secret: E2E_AUTH_SECRET,
};

const isolatedAuthEnv = e2eDbUrl
  ? {
      AUTH_URL: `http://127.0.0.1:${WEB_PORT}`,
      AUTH_SECRET: E2E_AUTH_SECRET,
      AUTH_ALLOWED_EMAILS: "astrology-e2e@example.test,other-e2e@example.test",
      GOOGLE_CLIENT_ID: "isolated-e2e-client",
      GOOGLE_CLIENT_SECRET: "isolated-e2e-secret",
    }
  : {
      AUTH_URL: "",
      AUTH_SECRET: "",
      AUTH_ALLOWED_EMAILS: "",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // shared standalone instances; specs are fast enough serially
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 90_000,
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
      command: `bash -c "cd ../api && RATE_LIMIT_DISABLED=1 .venv/bin/uvicorn app.main:app --port ${API_PORT}"`,
      url: `http://127.0.0.1:${API_PORT}/api/v1/health/ready`,
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
      timeout: 30_000,
    },
    {
      command: `bash -c "mkdir -p .next/standalone/apps/web/.next/static .next/standalone/apps/web/public && cp -a .next/static/. .next/standalone/apps/web/.next/static/ && cp -a public/. .next/standalone/apps/web/public/ && PORT=${WEB_PORT} node .next/standalone/apps/web/server.js"`,
      url: `http://127.0.0.1:${WEB_PORT}/en`,
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
      timeout: 60_000,
      env: {
        API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
        ASTROLOGY_DATABASE_URL: e2eDbUrl,
        ...isolatedAuthEnv,
      },
    },
    {
      command: `bash -c "mkdir -p .next/standalone/apps/web/.next/static .next/standalone/apps/web/public && cp -a .next/static/. .next/standalone/apps/web/.next/static/ && cp -a public/. .next/standalone/apps/web/public/ && PORT=${PUSH_WEB_PORT} node .next/standalone/apps/web/server.js"`,
      url: `http://127.0.0.1:${PUSH_WEB_PORT}/en`,
      reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "1",
      timeout: 60_000,
      env: {
        API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
        VAPID_PUBLIC_KEY: vapidKeys.publicKey,
        VAPID_PRIVATE_KEY: vapidKeys.privateKey,
        VAPID_SUBJECT: "mailto:e2e@example.com",
        INTERNAL_DISPATCH_KEY: PUSH_E2E.dispatchKey,
        ASTROLOGY_DATABASE_URL: e2eDbUrl,
        ...isolatedAuthEnv,
      },
    },
  ],
});
