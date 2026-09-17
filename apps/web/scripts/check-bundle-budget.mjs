import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const staticRoot = join(root, ".next", "static");
const budgets = {
  javascriptBytes: Number(process.env.BUNDLE_JS_BUDGET_BYTES ?? 1_750_000),
  cssBytes: Number(process.env.BUNDLE_CSS_BUDGET_BYTES ?? 100_000),
  largestJavaScriptBytes: Number(process.env.BUNDLE_LARGEST_JS_BUDGET_BYTES ?? 300_000),
};

const files = [];
async function walk(directory) {
  for (const name of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, name.name);
    if (name.isDirectory()) await walk(file);
    else if (/\.(js|css)$/.test(name.name)) files.push({ file, bytes: (await stat(file)).size });
  }
}

try {
  await walk(staticRoot);
} catch {
  throw new Error(`Missing ${staticRoot}; run the production build before checking the bundle.`);
}

const javascriptBytes = files.filter(({ file }) => file.endsWith(".js")).reduce((sum, file) => sum + file.bytes, 0);
const cssBytes = files.filter(({ file }) => file.endsWith(".css")).reduce((sum, file) => sum + file.bytes, 0);
const largestJavaScript = files.filter(({ file }) => file.endsWith(".js")).sort((a, b) => b.bytes - a.bytes)[0] ?? null;
const failures = [];
if (javascriptBytes > budgets.javascriptBytes) failures.push(`JavaScript ${javascriptBytes} > ${budgets.javascriptBytes} bytes`);
if (cssBytes > budgets.cssBytes) failures.push(`CSS ${cssBytes} > ${budgets.cssBytes} bytes`);
if (largestJavaScript && largestJavaScript.bytes > budgets.largestJavaScriptBytes) {
  failures.push(`largest JavaScript ${largestJavaScript.bytes} > ${budgets.largestJavaScriptBytes} bytes`);
}

console.log(JSON.stringify({ files: files.length, javascriptBytes, cssBytes, largestJavaScript, budgets }, null, 2));
if (failures.length) throw new Error(`Bundle budget failed: ${failures.join("; ")}`);
console.log("Bundle budget passed.");
