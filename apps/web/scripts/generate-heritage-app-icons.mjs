// Regenerate the installable-app icon family from the code-native heritage
// mark. Keeping this separate from OG rendering means a social-card refresh
// can never accidentally replace the small, recognisable PWA icon.
import { mkdirSync } from "node:fs";
import sharp from "sharp";

function mark(size, inset) {
  const c = size / 2;
  const r = size / 2 - inset;
  const inner = r * 0.7;
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17305b"/><stop offset="1" stop-color="#0b1327"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4d58a"/><stop offset=".5" stop-color="#b88a35"/><stop offset="1" stop-color="#87591a"/></linearGradient></defs>
    <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" fill="url(#g)"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="#13213f" stroke="url(#b)" stroke-width="${Math.max(2, size * .035)}"/>
    <circle cx="${c}" cy="${c}" r="${inner}" fill="none" stroke="url(#b)" stroke-width="${Math.max(1.5, size * .025)}"/>
    <path d="M${c} ${c - inner*.82}c${inner*.36} ${inner*.45} ${inner*.55} ${inner*.83} ${inner*.55} ${inner*1.14}a${inner*.55} ${inner*.55} 0 1 1 ${-inner*1.1} 0c0-${inner*.31} ${inner*.19}-${inner*.69} ${inner*.55}-${inner*1.14}Z" fill="url(#b)"/>
    <path d="M${c-inner*.9} ${c+inner*.55}c${inner*.58}-${inner*.09} ${inner*1.08} ${inner*.11} ${inner*1.5} ${inner*.61} ${inner*.42}-${inner*.5} ${inner*.92}-${inner*.7} ${inner*1.5}-${inner*.61} ${inner*.58}-${inner*.09} ${inner*1.08} ${inner*.11} ${inner*1.5} ${inner*.61} ${-inner*.36} ${inner*.54} ${-inner*.86} ${inner*.8} ${-inner*1.5} ${inner*.8} ${-inner*.64} 0 ${-inner*1.14}-${inner*.26} ${-inner*1.5}-${inner*.8}Z" fill="url(#b)"/>
    <circle cx="${c}" cy="${c}" r="${inner*.17}" fill="#13213f" stroke="#f4d58a" stroke-width="${Math.max(1.2, size*.018)}"/>
  </svg>`);
}

async function writeIcon(filename, size, maskable = false) {
  const inset = Math.round(size * (maskable ? 0.22 : 0.12));
  await sharp(mark(size, inset)).png().toFile(filename);
}

mkdirSync("public/icons/app", { recursive: true });
await writeIcon("public/icons/app/icon-180.png", 180);
await writeIcon("public/icons/app/icon-192.png", 192);
await writeIcon("public/icons/app/icon-512.png", 512);
await writeIcon("public/icons/app/icon-maskable-512.png", 512, true);
await sharp("public/icons/app/icon-180.png").png().toFile("public/icons/apple-touch-icon.png");
console.log("Rendered heritage PWA icon family");
