// Renders the static Open Graph share image (1200x630 PNG, committed to
// public/og/) plus the iOS apple-touch-icon from an original SVG design —
// dawn-gradient sky, a horizon sun, and the five Pancha Pakshi birds as
// simple original silhouette marks. Run manually when the design changes:
//   node scripts/generate-og-images.mjs
// Requires the Noto Sans Sinhala system font for the Sinhala platform name
// (fonts-noto-core on Ubuntu); fails loudly rather than shipping tofu.
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
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

// Simple original bird marks (abstract silhouettes, not copied artwork).
const birdMarks = [0, 1, 2, 3, 4]
  .map((i) => {
    const x = 390 + i * 110;
    const y = 470 - (i % 2) * 18;
    return `<g transform="translate(${x} ${y})" fill="rgba(255,255,255,0.85)">
      <ellipse cx="0" cy="0" rx="26" ry="14"/>
      <circle cx="22" cy="-10" r="8"/>
      <path d="M28 -11 l12 3 -12 3 z"/>
      <path d="M-18 -4 q-16 -14 -34 -10 q10 12 26 14 z" opacity="0.8"/>
    </g>`;
  })
  .join("\n");

const ogSvg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
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
  <rect width="1200" height="630" fill="url(#dawn)"/>
  <circle cx="600" cy="560" r="230" fill="url(#sun)"/>
  <text x="600" y="250" text-anchor="middle" font-family="Noto Sans, DejaVu Sans, sans-serif"
        font-size="64" font-weight="700" fill="#ffffff">Fernando Family Astrology</text>
  <text x="600" y="330" text-anchor="middle" font-family="Noto Sans Sinhala, sans-serif"
        font-size="48" font-weight="600" fill="#fef3c7">Fernando Family ජ්‍යෝතිෂ</text>
  <text x="600" y="395" text-anchor="middle" font-family="Noto Sans Sinhala, Noto Sans, sans-serif"
        font-size="30" fill="rgba(255,255,255,0.85)">Pancha Pakshi Live · පංච පක්ෂි සජීවී කාල සටහන</text>
  ${birdMarks}
</svg>`;

// apple-touch-icon: warm disc + a single peacock-style bird mark.
const appleIconSvg = `<svg width="180" height="180" viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#4c1d95"/>
      <stop offset="1" stop-color="#b45309"/>
    </linearGradient>
  </defs>
  <rect width="180" height="180" rx="36" fill="url(#bg)"/>
  <g transform="translate(88 96)" fill="#fde68a">
    <ellipse cx="0" cy="8" rx="34" ry="20"/>
    <circle cx="26" cy="-16" r="11"/>
    <path d="M34 -18 l16 5 -16 5 z"/>
    <path d="M20 -30 l3 -12 M28 -28 l8 -10 M12 -30 l-2 -12" stroke="#fde68a" stroke-width="4" stroke-linecap="round" fill="none"/>
    <path d="M-24 2 q-24 -18 -48 -12 q14 16 36 18 z" opacity="0.85"/>
  </g>
</svg>`;

mkdirSync("public/og", { recursive: true });
await sharp(Buffer.from(ogSvg)).png().toFile("public/og/og-default.png");
await sharp(Buffer.from(appleIconSvg)).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");
writeFileSync("public/og/og-default.svg", ogSvg);
console.log("Rendered public/og/og-default.png and public/icons/apple-touch-icon.png");
