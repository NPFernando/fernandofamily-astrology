import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = join(appRoot, "public");
const KiB = 1024;
const limits = {
  appIcon: 64 * KiB,
  generated: { 64: 16 * KiB, 128: 50 * KiB, 256: 180 * KiB },
  heroPoster: 300 * KiB,
  featurePoster: 64 * KiB,
  ogDefault: 1024 * KiB,
  ogFeature: 256 * KiB,
};

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    }),
  );
  return nested.flat();
}

async function enforce(path, limit, label) {
  const size = (await stat(path)).size;
  if (size > limit) {
    throw new Error(`${relative(appRoot, path)} is ${(size / KiB).toFixed(1)} KiB; ${label} budget is ${(limit / KiB).toFixed(0)} KiB.`);
  }
  return size;
}

let checked = 0;
for (const path of await files(join(publicRoot, "icons", "app"))) {
  if (path.endsWith(".png")) {
    await enforce(path, limits.appIcon, "app icon");
    checked += 1;
  }
}

for (const path of await files(join(publicRoot, "icons", "generated"))) {
  const size = path.match(/-(64|128|256)\.png$/)?.[1];
  if (!size) throw new Error(`Generated icon lacks a supported resolution suffix: ${relative(appRoot, path)}`);
  await enforce(path, limits.generated[size], `${size}px generated icon`);
  checked += 1;
}

for (const path of await files(join(publicRoot, "posters"))) {
  const limit = relative(join(publicRoot, "posters"), path).startsWith("features/") ? limits.featurePoster : limits.heroPoster;
  if (!/\.(avif|webp|jpg)$/.test(path)) throw new Error(`Poster must be AVIF, WebP, or JPEG: ${relative(appRoot, path)}`);
  await enforce(path, limit, limit === limits.heroPoster ? "hero poster" : "feature poster");
  checked += 1;
}

for (const path of await files(join(publicRoot, "og"))) {
  const isDefault = path.endsWith("og-default.png");
  await enforce(path, isDefault ? limits.ogDefault : limits.ogFeature, isDefault ? "default OG image" : "feature OG image");
  checked += 1;
}

console.log(`Asset-size budget check passed: ${checked} optimized visual assets within resolution-aware limits.`);
