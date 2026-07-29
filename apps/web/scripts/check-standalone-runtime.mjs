import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = 3212;
const telemetryToken = "standalone-telemetry-smoke-token";
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const server = fileURLToPath(new URL("../.next/standalone/apps/web/server.js", import.meta.url));

if (!existsSync(server)) {
  throw new Error("Standalone server is missing. Run pnpm build before this check.");
}

const child = spawn(process.execPath, ["scripts/start-standalone.mjs", "--port", String(port)], {
  cwd: appRoot,
  stdio: "inherit",
  detached: true,
  env: { ...process.env, IMAGE_TELEMETRY_DASHBOARD_TOKEN: telemetryToken },
});

let exitCode;
child.once("exit", (code, signal) => {
  exitCode = signal ?? code ?? 1;
});

async function waitFor(url) {
  const deadline = Date.now() + 20_000;
  let lastError;

  while (Date.now() < deadline) {
    if (exitCode !== undefined) {
      throw new Error(`Standalone server exited before it was ready (${exitCode}).`);
    }

    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for standalone server: ${lastError?.message ?? "unknown error"}`);
}

try {
  await waitFor(`http://127.0.0.1:${port}/en`);
  await waitFor(`http://127.0.0.1:${port}/icons/generated/birds/peacock-64.png`);
  const telemetryUrl = `http://127.0.0.1:${port}/api/telemetry/image-load`;
  const accepted = await fetch(telemetryUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ outcome: "loaded", transferBucket: "under-100kb", count: 1 }),
  });
  if (accepted.status !== 204) throw new Error(`Telemetry event was not accepted (${accepted.status}).`);
  const denied = await fetch(telemetryUrl);
  if (denied.status !== 404) throw new Error(`Telemetry export must fail closed (${denied.status}).`);
  const exported = await fetch(telemetryUrl, { headers: { authorization: `Bearer ${telemetryToken}` } });
  const report = await exported.json().catch(() => null);
  if (!exported.ok || !Array.isArray(report?.events) || !report.events.some((event) => event.outcome === "loaded" && event.count >= 1)) {
    throw new Error("Protected telemetry export did not contain the accepted aggregate.");
  }
  console.log("Standalone runtime check passed.");
} finally {
  if (exitCode === undefined && child.pid) {
    // start-standalone launches Next as its own child; terminate this detached
    // process group so a successful smoke test cannot leave a listening port.
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}
