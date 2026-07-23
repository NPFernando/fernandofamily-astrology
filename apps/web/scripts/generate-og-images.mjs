// Renders static social/app imagery from generated poster/icon sources.
// Run manually when generated artwork changes:
//   node scripts/generate-og-images.mjs
// Requires the Noto Sans Sinhala system font for the Sinhala platform name
// (fonts-noto-core on Ubuntu); fails loudly rather than shipping tofu.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
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

const BRAND_MARK = "assets/generated-posters/features/brand.png";
const LANDING_POSTER = "public/posters/landing-almanac.webp";
const en = JSON.parse(readFileSync("locales/en.json", "utf8"));
const si = JSON.parse(readFileSync("locales/si.json", "utf8"));

const FEATURES = [
  { id: "birth-nakshatra", titleKey: "features.birthNakshatra.title", descriptionKey: "features.birthNakshatra.description" },
  { id: "pancha-pakshi", titleKey: "features.panchaPakshi.title", descriptionKey: "features.panchaPakshi.description" },
  { id: "panchanga", titleKey: "features.panchanga.title", descriptionKey: "features.panchanga.description" },
  { id: "moon-calendar", titleKey: "features.moonCalendar.title", descriptionKey: "features.moonCalendar.description" },
  { id: "daily-guide", titleKey: "features.dailyGuide.title", descriptionKey: "features.dailyGuide.description" },
  { id: "muhurta", titleKey: "features.muhurta.title", descriptionKey: "features.muhurta.description" },
  { id: "compatibility", titleKey: "features.compatibility.title", descriptionKey: "features.compatibility.description" },
  { id: "divisional-charts", titleKey: "features.divisionalCharts.title", descriptionKey: "features.divisionalCharts.description" },
  { id: "porondam", titleKey: "features.porondam.title", descriptionKey: "features.porondam.description" },
  { id: "birth-chart", titleKey: "features.birthChart.title", descriptionKey: "features.birthChart.description" },
  { id: "dasha", titleKey: "features.dasha.title", descriptionKey: "features.dasha.description" },
];

function resolveKey(dict, key) {
  return key.split(".").reduce((current, part) => current?.[part], dict);
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clampWords(value, maxWords) {
  const words = String(value).split(/\s+/);
  return words.length <= maxWords ? value : `${words.slice(0, maxWords).join(" ")}...`;
}

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
    .resize(size - pad * 2, size - pad * 2, { fit: "cover" })
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
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#020617" stop-opacity="0.88"/>
      <stop offset="0.62" stop-color="#020617" stop-opacity="0.42"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <text x="96" y="172" font-family="Noto Sans, DejaVu Sans, sans-serif"
        font-size="62" font-weight="700" fill="#ffffff">Fernando Family Astrology</text>
  <text x="96" y="252" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="44" font-weight="600" fill="#fef3c7">Fernando Family ජ්‍යෝතිෂ</text>
  <text x="96" y="326" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="30" fill="rgba(255,255,255,0.88)">Sri Lankan Panchanga · Poya · Pancha Pakshi tools</text>
  <text x="96" y="380" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="30" fill="rgba(255,255,255,0.82)">ශ්‍රී ලංකා ජ්‍යෝතිෂ සැලසුම් සහ දින දර්ශන</text>
</svg>`);
  const mark = await sharp(BRAND_MARK).resize(410, 410, { fit: "contain" }).png().toBuffer();
  const poster = await sharp(LANDING_POSTER).resize(W, H, { fit: "cover" }).png().toBuffer();
  await sharp(poster)
    .composite([
      { input: bg, left: 0, top: 0 },
      { input: mark, left: 760, top: 130 },
    ])
    .flatten({ background: "#1e1b4b" })
    .removeAlpha()
    .png()
    .toFile("public/og/og-default.png");
}

async function featureOgImage(feature) {
  const W = 1200;
  const H = 630;
  const title = resolveKey(en, feature.titleKey);
  const sinhalaTitle = resolveKey(si, feature.titleKey);
  const description = clampWords(resolveKey(en, feature.descriptionKey), 15);
  const bg = await sharp(`public/posters/features/${feature.id}.webp`).resize(W, H, { fit: "cover" }).png().toBuffer();
  const icon = await sharp(`assets/generated-posters/features/${feature.id}.png`).resize(340, 340, { fit: "cover" }).png().toBuffer();
  const overlay = Buffer.from(`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="shade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#020617" stop-opacity="0.88"/>
      <stop offset="0.62" stop-color="#020617" stop-opacity="0.62"/>
      <stop offset="1" stop-color="#020617" stop-opacity="0.18"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#shade)"/>
  <text x="86" y="130" font-family="Noto Sans, DejaVu Sans, sans-serif"
        font-size="28" font-weight="700" fill="#f5b942">Fernando Family Astrology</text>
  <text x="86" y="226" font-family="Noto Sans, DejaVu Sans, sans-serif"
        font-size="68" font-weight="800" fill="#ffffff">${esc(title)}</text>
  <text x="86" y="300" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="40" font-weight="650" fill="#fef3c7">${esc(sinhalaTitle)}</text>
  <text x="86" y="370" font-family="Noto Sans, DejaVu Sans, sans-serif"
        font-size="30" fill="rgba(255,255,255,0.86)">${esc(description)}</text>
  <text x="86" y="504" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="28" fill="rgba(255,255,255,0.78)">astrology.fernandofamily.com</text>
</svg>`);
  await sharp(bg)
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: icon, left: 790, top: 145 },
    ])
    .flatten({ background: "#1e1b4b" })
    .removeAlpha()
    .png()
    .toFile(`public/og/${feature.id}.png`);
}

mkdirSync("public/icons/app", { recursive: true });
mkdirSync("public/og", { recursive: true });

await appIcon("public/icons/app/icon-180.png", 180);
await appIcon("public/icons/app/icon-192.png", 192);
await appIcon("public/icons/app/icon-512.png", 512);
await appIcon("public/icons/app/icon-maskable-512.png", 512, true);
await sharp("public/icons/app/icon-180.png").png().toFile("public/icons/apple-touch-icon.png");
await ogImage();
for (const feature of FEATURES) {
  await featureOgImage(feature);
}

console.log("Rendered generated app icons, apple-touch icon, default OG, and per-feature OG images");
