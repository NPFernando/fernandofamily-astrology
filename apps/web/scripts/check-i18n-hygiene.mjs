#!/usr/bin/env node
// Regression guard: no hardcoded user-facing English/Sinhala string literals
// in JSX text content — everything must be routed through the locale
// dictionary (dict.xxx) or nakshatra/enum lookup helpers. Heuristic, not
// exhaustive: flags raw multi-character text directly between JSX tags that
// isn't an expression ({...}).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "components"];
// A JSX text node: `>` then some non-tag, non-expression characters, then `<`.
const TEXT_NODE = />\s*([^<>{}\n][^<>{}\n]{2,})\s*</g;
// Ignore pure punctuation/whitespace/numeric content, and known-safe tokens.
const SAFE = /^[\s\d.,:/%-]*$/;
const EXCEPTION_FILES = new Set([]); // add relative paths here if a deliberate exception is ever needed

let violations = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walk(full);
    } else if (/\.tsx$/.test(entry)) {
      checkFile(full);
    }
  }
}

function checkFile(path) {
  if (EXCEPTION_FILES.has(path)) return;
  const src = readFileSync(path, "utf8");
  let m;
  while ((m = TEXT_NODE.exec(src))) {
    const text = m[1].trim();
    if (SAFE.test(text)) continue;
    if (text.split(/\s+/).length < 2) continue; // single tokens are usually fine (icons, symbols)
    const line = src.slice(0, m.index).split("\n").length;
    violations.push(`${path}:${line}: hardcoded JSX text "${text.slice(0, 60)}"`);
  }
}

for (const root of ROOTS) {
  try {
    walk(root);
  } catch {
    // root may not exist yet, ignore
  }
}

if (violations.length > 0) {
  console.error("i18n hygiene check FAILED:\n" + violations.join("\n"));
  process.exit(1);
}
console.log("i18n hygiene check passed: no hardcoded JSX text found.");
