// Unit test for lib/account-location.ts — run via `pnpm test`. Same
// lightweight-load approach as check-ics-generator.mjs: the module is plain
// TS with no imports, so a full transpile is overkill — strip the type
// syntax Node can't evaluate and run it directly.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../lib/account-location.ts"), "utf8");

const js = source
  .replace(/export type NormalizedAccountLocation = \{[\s\S]*?\};/, "")
  .replace(/: NormalizedAccountLocation \| "invalid" \| null/g, "")
  .replace(/: unknown/g, "")
  .replace(/: string/g, "")
  .replace(/: number/g, "")
  .replace(/ as Record<string, unknown>/g, "")
  .replace(/^export /m, "");

const loaded = { exports: {} };
new Function("module", "exports", js + "\nmodule.exports = { normalizeAccountLocation };")(loaded, loaded.exports);
const { normalizeAccountLocation } = loaded.exports;

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}

// The bug this guards: full-precision device coordinates must never reach
// storage — everything gets rounded to 2 decimals (~1km), same bound as
// push_subscriptions.
const rounded = normalizeAccountLocation({
  name: "Kandy, Sri Lanka",
  latitude: 7.290572123456,
  longitude: 80.633728987654,
  iana_tz: "Asia/Colombo",
});
assert(rounded !== "invalid" && rounded !== null, "valid input should not be rejected");
assert(rounded.latitude === 7.29, `latitude should round to 7.29, got ${rounded?.latitude}`);
assert(rounded.longitude === 80.63, `longitude should round to 80.63, got ${rounded?.longitude}`);

// null clears the saved default explicitly.
assert(normalizeAccountLocation(null) === null, "null should mean 'clear the default'");

// Out-of-range / malformed inputs are rejected, not silently clamped.
assert(normalizeAccountLocation({ name: "x", latitude: 91, longitude: 0, iana_tz: "Asia/Colombo" }) === "invalid",
  "latitude > 90 should be invalid");
assert(normalizeAccountLocation({ name: "x", latitude: 0, longitude: -181, iana_tz: "Asia/Colombo" }) === "invalid",
  "longitude < -180 should be invalid");
assert(normalizeAccountLocation({ name: "x", latitude: 0, longitude: 0, iana_tz: "Not/AZone" }) === "invalid",
  "an unrecognized IANA timezone should be invalid");
assert(normalizeAccountLocation({ name: "", latitude: 0, longitude: 0, iana_tz: "Asia/Colombo" }) === "invalid",
  "an empty name should be invalid");

if (failures > 0) {
  console.error(`${failures} failure(s) in check-account-location-rounding.mjs`);
  process.exit(1);
}
console.log("Account-location rounding check passed: server-side ~1km rounding, validation, and null-clears all correct.");
