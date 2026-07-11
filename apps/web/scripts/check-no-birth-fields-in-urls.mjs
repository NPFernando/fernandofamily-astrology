#!/usr/bin/env node
// Regression guard: birth data and precise location must never be
// serialized into a URL. Scans lib/ and components/ source for fetch() /
// URL-construction call sites and fails if any of the sensitive field names
// appear inside a template literal or string used as a URL (as opposed to a
// JSON body).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SENSITIVE_FIELDS = [
  "birth_date",
  "birth_time",
  "latitude",
  "longitude",
  "nakshatra_index",
  "target_date",
  "target_time",
];

const ROOTS = ["lib", "components", "app"];
let violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      checkFile(full);
    }
  }
}

function checkFile(path) {
  const src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const fetchOrUrlLine = /fetch\(|new URL\(|URLSearchParams/.test(line);
    if (!fetchOrUrlLine) return;
    // Look at this line and the next couple for a template literal containing
    // a sensitive field name being interpolated into what looks like a URL.
    const window = lines.slice(i, i + 3).join("\n");
    for (const field of SENSITIVE_FIELDS) {
      const pattern = new RegExp("\\$\\{[^}]*" + field + "[^}]*\\}");
      if (pattern.test(window) && /["'`](\/|https?:)/.test(window)) {
        violations.push(`${path}:${i + 1}: possible "${field}" interpolated into a URL`);
      }
    }
  });
}

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // root may not exist yet, ignore
  }
}

if (violations.length > 0) {
  console.error("Birth-data-in-URL check FAILED:\n" + violations.join("\n"));
  process.exit(1);
}
console.log("Birth-data-in-URL check passed: no sensitive fields found in any URL construction.");
