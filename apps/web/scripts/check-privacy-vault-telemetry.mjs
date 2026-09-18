import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const source = readFileSync(join(root, "lib/privacy-vault-telemetry.ts"), "utf8");
const route = readFileSync(join(root, "app/api/internal/privacy-vault-telemetry/route.ts"), "utf8");
const failures = [];
if (!source.includes("aggregate_only: true")) failures.push("telemetry must declare aggregate_only");
if (!source.includes("summarizeLegacyLocationRows")) failures.push("aggregate summarizer is missing");
if (!route.includes("x-internal-key")) failures.push("telemetry route must require an internal key");
if (!route.includes("Cache-Control")) failures.push("telemetry route must disable caching");
for (const forbidden of ["owner_email", "birth_date", "birth_time"]) {
  if (source.includes(forbidden) || route.includes(forbidden)) failures.push(`raw field leaked into telemetry: ${forbidden}`);
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log("privacy-vault telemetry contract passed: aggregate-only and internal-only");
