import { appendFile, readdir, stat } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const posterRoot = join(appRoot, "public", "posters");
const formats = ["avif", "webp", "jpg"];
const KiB = 1024;
const maxTotalIncreaseKiB = Number(process.env.POSTER_MAX_TOTAL_INCREASE_KIB ?? 512);
const execFile = promisify(execFileCallback);
const baseFlag = process.argv.indexOf("--base");
const baseRef = baseFlag === -1 ? undefined : process.argv[baseFlag + 1];

if (baseFlag !== -1 && !baseRef) throw new Error("--base requires a Git revision.");
const legacyMinSavings = process.env.POSTER_AVIF_MIN_SAVINGS_PERCENT;
const minFeatureAvifSavings = Number(process.env.POSTER_AVIF_MIN_FEATURE_SAVINGS_PERCENT ?? legacyMinSavings ?? 10);
const minHeroAvifSavings = Number(process.env.POSTER_AVIF_MIN_HERO_SAVINGS_PERCENT ?? legacyMinSavings ?? 20);

for (const [name, value] of Object.entries({
  POSTER_AVIF_MIN_FEATURE_SAVINGS_PERCENT: minFeatureAvifSavings,
  POSTER_AVIF_MIN_HERO_SAVINGS_PERCENT: minHeroAvifSavings,
  POSTER_MAX_TOTAL_INCREASE_KIB: maxTotalIncreaseKiB,
})) {
  const isPercentage = name !== "POSTER_MAX_TOTAL_INCREASE_KIB";
  if (!Number.isFinite(value) || value < 0 || (isPercentage && value >= 100)) {
    throw new Error(isPercentage
      ? `${name} must be a number from 0 up to (but not including) 100.`
      : `${name} must be a non-negative number.`);
  }
}

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}

const posters = await Promise.all(
  (await files(posterRoot)).map(async (path) => ({
    path,
    format: path.split(".").at(-1),
    bytes: (await stat(path)).size,
  })),
);

function formatRows(assets) {
  return formats.map((format) => {
    const formatAssets = assets.filter((asset) => asset.format === format);
    const total = formatAssets.reduce((sum, asset) => sum + asset.bytes, 0);
    const largest = formatAssets.reduce((max, asset) => Math.max(max, asset.bytes), 0);
    return { format: format.toUpperCase(), count: formatAssets.length, total, average: formatAssets.length === 0 ? 0 : total / formatAssets.length, largest };
  });
}

const rows = formatRows(posters);

if (rows.some((row) => row.count === 0)) {
  throw new Error(`Missing poster format variants: ${rows.filter((row) => row.count === 0).map((row) => row.format).join(", ")}`);
}

let baseRows;
if (baseRef) {
  const { stdout: repoRootOutput } = await execFile("git", ["rev-parse", "--show-toplevel"], { cwd: appRoot });
  const repoRoot = repoRootOutput.trim();
  const gitPosterRoot = relative(repoRoot, posterRoot);
  const { stdout } = await execFile("git", ["ls-tree", "-r", "--name-only", baseRef, "--", gitPosterRoot], { cwd: appRoot });
  const basePaths = stdout.trim().split("\n").filter((path) => /\.(avif|webp|jpg)$/.test(path));
  const basePosters = await Promise.all(basePaths.map(async (path) => {
    const { stdout: size } = await execFile("git", ["cat-file", "-s", `${baseRef}:${path}`], { cwd: appRoot });
    return { path, format: path.split(".").at(-1), bytes: Number(size.trim()) };
  }));
  baseRows = formatRows(basePosters);
}

const renderSize = (bytes) => `${(bytes / KiB).toFixed(1)} KiB`;
const renderDelta = (bytes) => `${bytes >= 0 ? "+" : "-"}${renderSize(Math.abs(bytes))}`;
const currentTotal = rows.reduce((sum, row) => sum + row.total, 0);
const baseTotal = baseRows?.reduce((sum, row) => sum + row.total, 0);
const totalIncreaseWarning = baseTotal === undefined || currentTotal - baseTotal <= maxTotalIncreaseKiB * KiB
  ? undefined
  : { delta: currentTotal - baseTotal, threshold: maxTotalIncreaseKiB * KiB };

const variants = new Map();
for (const poster of posters) {
  const key = relative(posterRoot, poster.path).replace(/\.(avif|webp|jpg)$/, "");
  variants.set(key, { ...variants.get(key), [poster.format]: poster });
}

const comparisons = [...variants.entries()].map(([name, variant]) => {
  if (!variant.avif || !variant.webp) throw new Error(`Missing AVIF or WebP variant for ${name}.`);
  const isFeature = name.startsWith("features/");
  return {
    name,
    avif: variant.avif,
    webp: variant.webp,
    kind: isFeature ? "Feature" : "Hero",
    target: isFeature ? minFeatureAvifSavings : minHeroAvifSavings,
    savings: ((variant.webp.bytes - variant.avif.bytes) / variant.webp.bytes) * 100,
  };
});
const avifSavings = ((rows.find((row) => row.format === "WEBP").total - rows.find((row) => row.format === "AVIF").total) / rows.find((row) => row.format === "WEBP").total) * 100;
const warnings = comparisons.filter((comparison) => comparison.savings < comparison.target);

const markdown = [
  "## Poster payload report",
  "",
  "| Format | Files | Total | Average | Largest |",
  "| --- | ---: | ---: | ---: | ---: |",
  ...rows.map((row) => `| ${row.format} | ${row.count} | ${renderSize(row.total)} | ${renderSize(row.average)} | ${renderSize(row.largest)} |`),
  ...(baseRows ? [
    "",
    `### Change vs \`${baseRef}\``,
    "",
    "| Format | Base total | Current total | Delta |",
    "| --- | ---: | ---: | ---: |",
    ...rows.map((row) => {
      const base = baseRows.find((candidate) => candidate.format === row.format);
      return `| ${row.format} | ${renderSize(base.total)} | ${renderSize(row.total)} | ${renderDelta(row.total - base.total)} |`;
    }),
    "",
    `Total poster payload: ${renderSize(baseTotal)} → ${renderSize(currentTotal)} (${renderDelta(currentTotal - baseTotal)}). Warning threshold: +${renderSize(maxTotalIncreaseKiB * KiB)}.`,
  ] : []),
  "",
  `AVIF is **${avifSavings.toFixed(1)}% smaller** than WebP in total. Targets: feature posters at least ${minFeatureAvifSavings.toFixed(1)}%; hero posters at least ${minHeroAvifSavings.toFixed(1)}%.`,
  ...(totalIncreaseWarning ? ["", `> Warning: total poster payload increased by ${renderSize(totalIncreaseWarning.delta)} (threshold: ${renderSize(totalIncreaseWarning.threshold)}).`] : []),
  ...(warnings.length === 0 ? [] : [
    "",
    "### AVIF savings warnings",
    "",
    "| Poster | Type | AVIF | WebP | Saving | Target |",
    "| --- | --- | ---: | ---: | ---: | ---: |",
    ...warnings.map((warning) => `| ${warning.name} | ${warning.kind} | ${renderSize(warning.avif.bytes)} | ${renderSize(warning.webp.bytes)} | ${warning.savings.toFixed(1)}% | ${warning.target.toFixed(1)}% |`),
  ]),
  "",
  `Source: ${relative(appRoot, posterRoot)}`,
].join("\n");

console.log(markdown);
if (totalIncreaseWarning) {
  const message = `Total poster payload increased by ${renderSize(totalIncreaseWarning.delta)} (threshold: ${renderSize(totalIncreaseWarning.threshold)}).`;
  if (process.env.GITHUB_ACTIONS === "true") {
    console.warn(`::warning title=Poster payload increase::${message}`);
  } else {
    console.warn(`Warning: ${message}`);
  }
}
for (const warning of warnings) {
  const message = `AVIF is only ${warning.savings.toFixed(1)}% smaller than WebP (target: ${warning.target.toFixed(1)}% for ${warning.kind.toLowerCase()} posters).`;
  if (process.env.GITHUB_ACTIONS === "true") {
    console.warn(`::warning file=apps/web/public/posters/${warning.name}.avif::${message}`);
  } else {
    console.warn(`Warning: ${warning.name}.avif — ${message}`);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
}
