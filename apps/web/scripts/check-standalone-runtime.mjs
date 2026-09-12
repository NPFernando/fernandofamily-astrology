import { cpSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Next's standalone trace can omit Sharp's platform-specific libvips payload.
// Load the copied dependency from the exact production runtime before the E2E
// suite starts, so a missing native library is a short, actionable failure.
const standaloneDir = resolve(".next/standalone/apps/web");
const brandIcon = resolve(standaloneDir, "public/icons/app/icon-512.png");

if (!existsSync(standaloneDir)) throw new Error("Next standalone output is missing.");
// Next intentionally leaves public/ and .next/static for the deployer to
// copy. Prepare them here as the E2E production-runtime equivalent.
mkdirSync(resolve(standaloneDir, ".next/static"), { recursive: true });
mkdirSync(resolve(standaloneDir, "public"), { recursive: true });
cpSync(resolve(".next/static"), resolve(standaloneDir, ".next/static"), { recursive: true, force: true });
cpSync(resolve("public"), resolve(standaloneDir, "public"), { recursive: true, force: true });
if (!existsSync(brandIcon)) throw new Error("Standalone public assets are missing.");

const check = spawnSync(process.execPath, ["-e", "require('sharp')"], {
  cwd: standaloneDir,
  encoding: "utf8",
});
if (check.status !== 0) {
  throw new Error(`Standalone Sharp runtime check failed:\n${check.stderr || check.stdout}`);
}

console.log("Standalone Sharp runtime and public assets are available.");
