// Unit test for lib/ics.ts — run via `pnpm test`. Uses the compiled-by-tsx
// path: the module is plain TS with no imports, so a tiny transpile via
// esbuild-free regex is overkill — instead we re-implement nothing and load
// the real file through Node's TS-stripping (Node 22.6+ --experimental) or,
// portably, a minimal on-the-fly transform: the file contains only `export`
// keywords to strip for CommonJS-style evaluation.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, "../lib/ics.ts"), "utf8");

// Strip TS type syntax that plain Node can't evaluate: the export type block
// and parameter/return annotations. Narrow, file-specific transform — if
// lib/ics.ts grows fancier TS, switch this check to vitest instead.
const js = source
  .replace(/export type IcsEvent = \{[\s\S]*?\};/, "")
  .replace(/: IcsEvent\[\]/g, "")
  .replace(/: string(\[\])?/g, "")
  .replace(/: number/g, "")
  .replace(/: Date\)/g, ")")
  .replace(/export function/g, "function");

const { buildIcs } = new Function(`${js}; return { buildIcs };`)();

let failures = 0;
function check(name, cond) {
  if (!cond) {
    console.error(`ICS TEST FAIL: ${name}`);
    failures++;
  }
}

const ics = buildIcs([
  {
    uid: "w-1-2026-07-14",
    start: new Date("2026-07-14T06:04:55+05:30"),
    end: new Date("2026-07-14T06:42:03+05:30"),
    summary: "Peacock — Ruling (Raja) · very favourable; test, with\nnewline",
    description:
      "A deliberately long description intended to exceed seventy-five octets so that the folding logic is exercised end to end across multiple continuation lines.",
  },
]);

check("starts with BEGIN:VCALENDAR", ics.startsWith("BEGIN:VCALENDAR\r\n"));
check("ends with END:VCALENDAR CRLF", ics.endsWith("END:VCALENDAR\r\n"));
check("CRLF line endings only", !/[^\r]\n/.test(ics));
check("has VEVENT", ics.includes("BEGIN:VEVENT") && ics.includes("END:VEVENT"));
// +05:30 06:04:55 -> 00:34:55Z
check("DTSTART converted to UTC", ics.includes("DTSTART:20260714T003455Z"));
check("DTEND converted to UTC", ics.includes("DTEND:20260714T011203Z"));
check("semicolon escaped", ics.includes("very favourable\\;"));
check("comma escaped", ics.includes("test\\,"));
check("newline escaped", ics.includes("\\nnewline"));
check(
  "all lines <= 75 octets",
  ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75),
);
check("folded continuation exists", /\r\n [^\r\n]/.test(ics));
check("UID domain suffix", ics.includes("@astrology.fernandofamily.com"));

if (failures > 0) process.exit(1);
console.log("ICS generator check passed: escaping, folding, UTC conversion all correct.");
