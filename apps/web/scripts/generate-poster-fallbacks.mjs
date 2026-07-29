import { readdir, rm } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp from "sharp";

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  }));
  return nested.flat();
}

const responsiveWidths = [480, 960, 1440];
const posterFiles = (await files("public/posters")).filter((path) => extname(path) === ".webp" && !/-\d+\.webp$/.test(path) && !path.endsWith("-mobile.webp"));
for (const webpPath of posterFiles) {
  const avifPath = `${webpPath.slice(0, -".webp".length)}.avif`;
  const fallbackPath = `${webpPath.slice(0, -".webp".length)}.jpg`;
  const basePath = webpPath.slice(0, -".webp".length);
  await sharp(webpPath).avif({ quality: 58, effort: 2 }).toFile(avifPath);
  await sharp(webpPath).jpeg({ quality: 84, mozjpeg: true }).toFile(fallbackPath);
  for (const width of responsiveWidths) {
    await sharp(webpPath).resize({ width, withoutEnlargement: true }).avif({ quality: 58, effort: 2 }).toFile(`${basePath}-${width}.avif`);
    await sharp(webpPath).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(`${basePath}-${width}.webp`);
    await sharp(webpPath).resize({ width, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(`${basePath}-${width}.jpg`);
  }
  for (const format of ["avif", "webp", "jpg"]) await rm(`${basePath}-mobile.${format}`, { force: true });
}

console.log(`Rendered ${posterFiles.length} poster families at ${responsiveWidths.join(", ")}, and 1920px widths`);
