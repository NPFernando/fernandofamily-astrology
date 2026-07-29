import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const manifest = JSON.parse(readFileSync(".next/build-manifest.json", "utf8"));
const files = [...manifest.polyfillFiles, ...manifest.rootMainFiles];
const chunks = files.map((file) => ({ file, bytes: statSync(join(".next", file)).size })).sort((a, b) => b.bytes - a.bytes);
const total = chunks.reduce((sum, chunk) => sum + chunk.bytes, 0);
const limit = Number(process.env.INITIAL_BUNDLE_MAX_BYTES ?? 650_000);

console.log(`Initial shared JavaScript: ${(total / 1024).toFixed(1)} KiB across ${chunks.length} chunks (limit ${(limit / 1024).toFixed(1)} KiB).`);
for (const chunk of chunks.filter((entry) => entry.bytes >= 100_000)) {
  console.log(`Lazy-load candidate: ${(chunk.bytes / 1024).toFixed(1)} KiB ${chunk.file}`);
}
if (total > limit) {
  console.error("Initial shared JavaScript budget exceeded. Inspect the listed chunks and move optional UI behind dynamic imports.");
  process.exit(1);
}
