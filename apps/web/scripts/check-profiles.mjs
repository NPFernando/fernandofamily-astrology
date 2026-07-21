// Unit test for lib/profiles.ts's dedup/identity logic — run via `pnpm test`.
// Same lightweight-load approach as check-ics-generator.mjs and
// check-account-location-rounding.mjs, but scoped to extracting just the two
// pure, exported functions this script needs (normalizeProfile, sameIdentity)
// rather than stripping the whole file's types — the rest of profiles.ts is
// async fetch/localStorage logic with generics (Omit<...>, Promise<...>)
// that would be fragile to regex-strip and isn't pure logic worth this kind
// of check anyway.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../lib/profiles.ts"), "utf8");

function extractFunction(name) {
  const start = source.indexOf(`export function ${name}(`);
  if (start === -1) throw new Error(`${name} not found in lib/profiles.ts`);
  // Balance braces from the function's opening brace to find its real end —
  // simple slice-to-next-blank-line would break if the function ever grows
  // a nested block.
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let end = bodyStart;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  return source
    .slice(start, end)
    .replace(/^export /, "")
    .replace(/: SavedProfile/g, "")
    .replace(/: boolean/g, "");
}

const js = `${extractFunction("normalizeProfile")}\n${extractFunction("sameIdentity")}`;
const loaded = { exports: {} };
new Function("module", "exports", `${js}\nmodule.exports = { normalizeProfile, sameIdentity };`)(loaded, loaded.exports);
const { normalizeProfile, sameIdentity } = loaded.exports;

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${message}`);
  }
}

const base = {
  id: "a",
  label: "Me",
  bird: "peacock",
  nakshatra_index: null,
  paksha: null,
  moon_rashi_index: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

// normalizeProfile: undefined moon_rashi_index (e.g. an older stored profile
// predating that field) must become null, not stay undefined — downstream
// identity/merge comparisons rely on it always being a concrete value.
const withoutMoonRashi = Object.fromEntries(
  Object.entries(base).filter(([key]) => key !== "moon_rashi_index"),
);
const normalized = normalizeProfile(withoutMoonRashi);
assert(normalized.moon_rashi_index === null, "missing moon_rashi_index should normalize to null");

const explicit = normalizeProfile({ ...base, moon_rashi_index: 4 });
assert(explicit.moon_rashi_index === 4, "an explicit moon_rashi_index should be preserved");

// sameIdentity: the exact dedup rule mergeLocalToServerOnce and listProfiles
// rely on to avoid duplicating a user's saved profile across local/server.
assert(sameIdentity(base, { ...base, id: "b", created_at: "2027-01-01T00:00:00.000Z" }),
  "profiles differing only in id/created_at should be the same identity");
assert(!sameIdentity(base, { ...base, label: "Someone else" }),
  "a different label should be a different identity");
assert(!sameIdentity(base, { ...base, bird: "owl" }),
  "a different bird should be a different identity");
assert(!sameIdentity(base, { ...base, nakshatra_index: 5, bird: null }),
  "a different nakshatra_index should be a different identity");
assert(!sameIdentity(base, { ...base, moon_rashi_index: 7 }),
  "a different moon_rashi_index should be a different identity");

if (failures > 0) {
  console.error(`${failures} failure(s) in check-profiles.mjs`);
  process.exit(1);
}
console.log("Profiles identity check passed: normalization and dedup-identity logic both correct.");
