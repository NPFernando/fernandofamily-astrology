// Text-free feature posters: locale-neutral backgrounds with a semantic glyph
// in the same indigo/brass language as the app mark. The UI supplies all
// readable English/Sinhala copy, so these are safe to reuse everywhere.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const features = [
  ["birth-nakshatra", "star"], ["pancha-pakshi", "bird"], ["panchanga", "sun"], ["moon-calendar", "moon"],
  ["daily-guide", "guide"], ["family-almanac", "calendar"], ["muhurta", "flame"], ["compatibility", "pair"],
  ["divisional-charts", "diamond"], ["porondam", "pair"], ["birth-chart", "diamond"], ["horoscope-report", "scroll"], ["dasha", "rings"],
];

function glyph(kind) {
  if (kind === "moon") return '<path d="M540 250a150 150 0 1 0 90 244A132 132 0 1 1 540 250Z"/>';
  if (kind === "sun") return '<circle cx="540" cy="390" r="88"/><path d="M540 210v52M540 518v52M360 390h52M668 390h52M413 263l37 37M630 480l37 37M667 263l-37 37M450 480l-37 37"/>';
  if (kind === "bird") return '<path d="M345 455c92-10 153-63 195-160 28 79 86 126 181 141-80 53-155 66-224 43-56 55-119 69-184 45 23-28 28-50 32-69Z"/>';
  if (kind === "calendar") return '<rect x="370" y="245" width="340" height="290" rx="24"/><path d="M370 340h340M455 245v290M625 245v290"/>';
  if (kind === "flame") return '<path d="M540 215c89 102 133 181 133 264a133 133 0 1 1-266 0c0-83 44-162 133-264Zm0 147c-31 41-47 77-47 111a47 47 0 0 0 94 0c0-34-16-70-47-111Z"/>';
  if (kind === "pair") return '<circle cx="475" cy="390" r="83"/><circle cx="605" cy="390" r="83"/><path d="M528 390h24"/>';
  if (kind === "diamond") return '<path d="M540 200 735 390 540 580 345 390 540 200Z"/><path d="M540 200v380M345 390h390M442 292l196 196M638 292 442 488"/>';
  if (kind === "scroll") return '<rect x="405" y="215" width="270" height="350" rx="24"/><path d="M465 320h150M465 390h150M465 460h95"/>';
  if (kind === "rings") return '<circle cx="540" cy="390" r="155"/><circle cx="540" cy="390" r="83"/><path d="M540 235v155l85 50"/>';
  if (kind === "guide") return '<path d="M390 475h300M430 410h220M470 345h140"/><path d="M540 225v75M430 270l45 45M650 270l-45 45"/>';
  return '<path d="m540 205 38 110 116 2-92 70 33 113-95-67-95 67 33-113-92-70 116-2 38-110Z"/>';
}

function poster(kind) {
  return Buffer.from(`<svg width="1920" height="1080" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b1327"/><stop offset=".6" stop-color="#17305b"/><stop offset="1" stop-color="#216d68"/></linearGradient><linearGradient id="brass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4d58a"/><stop offset=".48" stop-color="#b88a35"/><stop offset="1" stop-color="#87591a"/></linearGradient></defs>
    <rect width="1920" height="1080" fill="url(#bg)"/>
    <g fill="none" stroke="#f4d58a" stroke-opacity=".18" stroke-width="4"><circle cx="1460" cy="540" r="430"/><circle cx="1460" cy="540" r="350"/><path d="M1010 180C1270 310 1530 770 1900 900M1040 900c310-160 460-570 840-720"/></g>
    <g transform="translate(920 150)" fill="none" stroke="url(#brass)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">${glyph(kind)}</g>
    <g fill="#f4d58a" fill-opacity=".55"><circle cx="180" cy="180" r="7"/><circle cx="310" cy="300" r="5"/><circle cx="230" cy="800" r="6"/><circle cx="790" cy="170" r="5"/></g>
  </svg>`);
}

mkdirSync("public/posters/features", { recursive: true });
mkdirSync("assets/generated-posters/features", { recursive: true });
for (const [id, kind] of features) {
  const source = sharp(poster(kind));
  await source.png().toFile(`assets/generated-posters/features/${id}.png`);
  await sharp(poster(kind)).webp({ quality: 88 }).toFile(`public/posters/features/${id}.webp`);
  await sharp(poster(kind)).jpeg({ quality: 84, mozjpeg: true }).toFile(`public/posters/features/${id}.jpg`);
}
console.log(`Rendered ${features.length} heritage feature posters with JPEG fallbacks`);
