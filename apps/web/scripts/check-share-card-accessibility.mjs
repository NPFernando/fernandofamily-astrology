import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const routes = [
  "app/api/share-card/route.ts",
  "app/api/share-family-card/route.ts",
  "app/api/share-horoscope-report/route.ts",
];

function hex(value) {
  return [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

function blend(foreground, background, alpha) {
  return foreground.map((value, index) => value * alpha + background[index] * (1 - alpha));
}

function luminance(rgb) {
  const [red, green, blue] = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function requireContrast(name, background, textAlpha, rowAlpha = 0) {
  const row = rowAlpha ? blend([255, 255, 255], hex(background), rowAlpha) : hex(background);
  const text = blend([255, 255, 255], row, textAlpha);
  const ratio = contrast(text, row);
  if (ratio < 4.5) throw new Error(`${name} contrast is ${ratio.toFixed(2)}:1; expected at least 4.5:1.`);
}

for (const route of routes) {
  const source = await readFile(join(appRoot, route), "utf8");
  const lowContrastText = [...source.matchAll(/<text\b[^>]*\bfill="rgba\(255,255,255,(0\.\d+)\)"/g)]
    .map((match) => Number(match[1]))
    .filter((alpha) => alpha < 0.76);
  if (lowContrastText.length > 0) {
    throw new Error(`${route} has text below the 0.76 white-alpha contrast floor: ${lowContrastText.join(", ")}`);
  }
}

// Test the darkest/brightest gradient stops under the translucent text rows.
for (const background of ["#14532d", "#78350f"]) {
  requireContrast(`Family card row on ${background}`, background, 0.76, 0.12);
}
for (const background of ["#0f5b52", "#92400e"]) {
  requireContrast(`Horoscope card row on ${background}`, background, 0.9, 0.12);
}
requireContrast("Pancha Pakshi card footer", "#92400e", 0.76);

console.log("Share-card accessibility check passed: labelled controls are axe-covered and all small card text meets a 4.5:1 contrast floor.");
