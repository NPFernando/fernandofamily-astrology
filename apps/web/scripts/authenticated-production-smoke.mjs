import { chromium } from "@playwright/test";

const baseUrl = (process.env.DEPLOY_URL ?? "").replace(/\/$/, "");
const encodedState = process.env.ASTROLOGY_AUTH_STORAGE_STATE_B64 ?? "";
const expectedCommit = process.env.EXPECTED_COMMIT ?? "";

if (!baseUrl.startsWith("https://")) throw new Error("DEPLOY_URL must be an HTTPS production URL");
if (!encodedState) throw new Error("ASTROLOGY_AUTH_STORAGE_STATE_B64 is required");

let storageState;
try {
  storageState = JSON.parse(Buffer.from(encodedState, "base64").toString("utf8"));
} catch {
  throw new Error("ASTROLOGY_AUTH_STORAGE_STATE_B64 is not valid base64 JSON");
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  const checks = [];

  const session = await context.request.get(`${baseUrl}/api/auth/session`);
  if (!session.ok()) throw new Error(`Authenticated session endpoint returned HTTP ${session.status()}`);
  const sessionBody = await session.json();
  if (!sessionBody?.user?.email) throw new Error("Storage state did not produce a user session");
  checks.push("authenticated-session");

  for (const endpoint of ["preferences", "profiles"]) {
    const response = await context.request.get(`${baseUrl}/api/account/${endpoint}`);
    if (!response.ok()) throw new Error(`Protected ${endpoint} endpoint returned HTTP ${response.status()}`);
    checks.push(`protected-${endpoint}`);
  }

  const pageResponse = await page.goto(`${baseUrl}/en/`, { waitUntil: "domcontentloaded" });
  if (!pageResponse?.ok()) throw new Error(`Production homepage returned HTTP ${pageResponse?.status() ?? "unknown"}`);
  await page.getByRole("main").waitFor({ state: "visible", timeout: 15_000 });
  checks.push("authenticated-browser-page");

  const metadata = await context.request.get(`${baseUrl}/api/v1/metadata`);
  if (!metadata.ok()) throw new Error(`Metadata endpoint returned HTTP ${metadata.status()}`);
  const metadataBody = await metadata.json();
  if (expectedCommit && metadataBody.deployed_commit !== expectedCommit) {
    throw new Error(`Deployed commit mismatch: expected ${expectedCommit}, got ${metadataBody.deployed_commit}`);
  }
  checks.push("release-metadata");
  console.log(JSON.stringify({ baseUrl, authenticated: true, deployedCommit: metadataBody.deployed_commit, checks }));
} finally {
  await browser.close();
}
