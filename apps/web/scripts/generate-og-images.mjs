// Renders static social/app imagery from the generated brand mark source.
// Run manually when generated artwork changes:
//   node scripts/generate-og-images.mjs
// Requires the Noto Sans Sinhala system font for the Sinhala platform name
// (fonts-noto-core on Ubuntu); fails loudly rather than shipping tofu.
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const sinhalaFontInstalled = (() => {
  try {
    return execSync("fc-list | grep -ci sinhala", { shell: "/bin/bash" }).toString().trim() !== "0";
  } catch {
    return false;
  }
})();
if (!sinhalaFontInstalled) {
  console.error("No Sinhala font found (need e.g. fonts-noto-core) — refusing to render tofu.");
  process.exit(1);
}

const BRAND_MARK = "assets/generated-icons/transparent/brand-mark.png";

async function appIcon(output, size, maskable = false) {
  const pad = Math.round(size * (maskable ? 0.18 : 0.1));
  const radius = Math.round(size * 0.2);
  const bg = Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4c1d95"/>
      <stop offset="0.52" stop-color="#7c2d12"/>
      <stop offset="1" stop-color="#f59e0b"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
</svg>`);
  const mark = await sharp(BRAND_MARK)
    .resize(size - pad * 2, size - pad * 2, { fit: "contain" })
    .png()
    .toBuffer();
  await sharp(bg)
    .composite([{ input: mark, left: pad, top: pad }])
    .flatten({ background: "#7c2d12" })
    .removeAlpha()
    .png()
    .toFile(output);
}

async function ogImage() {
  const W = 1200;
  const H = 630;
  const bg = Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="dawn" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="#1e1b4b"/>
      <stop offset="0.4" stop-color="#4c1d95"/>
      <stop offset="0.78" stop-color="#b45309"/>
      <stop offset="1" stop-color="#f5b942"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fde68a"/>
      <stop offset="1" stop-color="#f59e0b" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#dawn)"/>
  <circle cx="600" cy="560" r="250" fill="url(#sun)"/>
  <text x="96" y="172" font-family="Noto Sans, DejaVu Sans, sans-serif"
        font-size="62" font-weight="700" fill="#ffffff">Fernando Family Astrology</text>
  <text x="96" y="252" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="44" font-weight="600" fill="#fef3c7">Fernando Family ජ්‍යෝතිෂ</text>
  <text x="96" y="318" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="30" fill="rgba(255,255,255,0.86)">Pancha Pakshi Live · පංච පක්ෂි සජීවී කාල සටහන</text>
</svg>`);
  const mark = await sharp(BRAND_MARK).resize(410, 410, { fit: "contain" }).png().toBuffer();
  await sharp(bg)
    .composite([{ input: mark, left: 750, top: 145 }])
    .flatten({ background: "#1e1b4b" })
    .removeAlpha()
    .png()
    .toFile("public/og/og-default.png");
}

mkdirSync("public/icons/app", { recursive: true });
mkdirSync("public/og", { recursive: true });

await appIcon("public/icons/app/icon-180.png", 180);
await appIcon("public/icons/app/icon-192.png", 192);
await appIcon("public/icons/app/icon-512.png", 512);
await appIcon("public/icons/app/icon-maskable-512.png", 512, true);
await sharp("public/icons/app/icon-180.png").png().toFile("public/icons/apple-touch-icon.png");
await ogImage();

console.log("Rendered generated app icons, apple-touch icon, and public/og/og-default.png");
