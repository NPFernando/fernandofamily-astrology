import { access, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const migrations = ["001_init.sql", "002_push.sql", "003_profile_moon_rashi.sql", "003_push_quiet_hours.sql", "004_push_alert_rules.sql"];
const requiredAssets = ["public/sw.js", "public/icons/app/icon-192.png", "public/icons/app/icon-512.png", "public/icons/app/icon-maskable-512.png", "public/icons/apple-touch-icon.png"];

for (const file of requiredAssets) await access(resolve(root, file));
const migrationFiles = await readdir(resolve(root, "db/migrations"));
for (const migration of migrations) {
  if (!migrationFiles.includes(migration)) throw new Error(`Required migration is missing: ${migration}`);
}

const serviceWorker = await readFile(resolve(root, "public/sw.js"), "utf8");
if (!serviceWorker.includes("CACHE_NAME") || !serviceWorker.includes("/icons/app/icon-192.png")) {
  throw new Error("Service worker is missing its cache identifier or primary app icon.");
}

console.log("Release-readiness files are present. Database migrations still require explicit deployment.");
