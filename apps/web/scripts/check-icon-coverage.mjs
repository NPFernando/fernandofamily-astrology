import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = join(appRoot, "public");
const resolutions = [64, 128, 256];
const birds = ["vulture", "owl", "crow", "cock", "peacock"];
const activities = ["ruling", "eating", "walking", "sleeping", "dying"];
const semanticSvgFiles = new Set([
  "components/charts/RasiStyleChart.tsx",
  "components/icons/features.tsx",
  "components/icons/heritage-mark.tsx",
  "components/icons/moon.tsx",
  "components/icons/sun.tsx",
  "components/layout/Nav.tsx",
]);

async function requireFile(path) {
  try {
    await access(path);
  } catch {
    throw new Error(`Missing required visual asset: ${path.replace(`${appRoot}/`, "")}`);
  }
}

async function sourceFiles(directory) {
  const entries = await readdir(join(appRoot, directory), { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const relative = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return sourceFiles(relative);
      return /\.tsx?$/.test(entry.name) ? [relative] : [];
    }),
  );
  return files.flat();
}

const featureAssets = await readFile(join(appRoot, "lib/feature-assets.ts"), "utf8");
const featureList = featureAssets.match(/FEATURE_VISUAL_IDS\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
const features = [...featureList.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
if (features.length === 0) throw new Error("Unable to read FEATURE_VISUAL_IDS for icon coverage.");

for (const [kind, ids] of [
  ["birds", birds],
  ["activities", activities],
  ["features", [...features, "brand"]],
]) {
  for (const id of ids) {
    for (const size of resolutions) await requireFile(join(publicRoot, "icons", "generated", kind, `${id}-${size}.png`));
  }
}

for (const file of ["icon-180.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png"]) {
  await requireFile(join(publicRoot, "icons", "app", file));
}
await requireFile(join(publicRoot, "icons", "apple-touch-icon.png"));
for (const id of features) await requireFile(join(publicRoot, "og", `${id}.png`));
await requireFile(join(publicRoot, "og", "og-default.png"));

for (const relativePath of ["landing-heritage-v2", "landing-almanac", ...features.map((id) => `features/${id}`), "features/brand"]) {
  for (const suffix of ["", "-480", "-960", "-1440"]) {
    await requireFile(join(publicRoot, "posters", `${relativePath}${suffix}.avif`));
    await requireFile(join(publicRoot, "posters", `${relativePath}${suffix}.webp`));
    await requireFile(join(publicRoot, "posters", `${relativePath}${suffix}.jpg`));
  }
}

const worker = await readFile(join(publicRoot, "sw.js"), "utf8");
for (const shellAsset of [
  "/en",
  "/si",
  "/icons/app/icon-192.png",
  "/icons/app/icon-512.png",
  "/icons/app/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/manifest.webmanifest",
]) {
  if (!worker.includes(shellAsset)) throw new Error(`Service worker does not precache required shell asset ${shellAsset}`);
}
const precacheSection = worker.slice(worker.indexOf("const PRECACHE_URLS"), worker.indexOf('self.addEventListener("install"'));
if (precacheSection.includes('"/posters/') || precacheSection.includes('"/icons/generated/')) {
  throw new Error("Service worker precache must stay limited to the offline shell; visual assets cache at runtime.");
}

for (const route of ["app/api/share-family-card/route.ts", "app/api/share-horoscope-report/route.ts"]) {
  const source = await readFile(join(appRoot, route), "utf8");
  if (!source.includes("icons", "generated") || !source.includes("-256.png")) {
    throw new Error(`${route} must compose the generated 256px badge assets.`);
  }
}

const svgFiles = [];
for (const directory of ["app/[locale]", "components"]) {
  for (const file of await sourceFiles(directory)) {
    if ((await readFile(join(appRoot, file), "utf8")).includes("<svg")) svgFiles.push(file);
  }
}
const unexpectedSvg = svgFiles.filter((file) => !semanticSvgFiles.has(file));
const missingSvg = [...semanticSvgFiles].filter((file) => !svgFiles.includes(file));
if (unexpectedSvg.length || missingSvg.length) {
  throw new Error(`Unreviewed visual SVG usage. Unexpected: ${unexpectedSvg.join(", ") || "none"}. Missing: ${missingSvg.join(", ") || "none"}.`);
}

console.log(`Icon coverage check passed: ${birds.length} birds, ${activities.length} activities, ${features.length} feature assets, and approved semantic SVGs.`);
