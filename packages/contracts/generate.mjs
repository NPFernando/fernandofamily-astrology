#!/usr/bin/env node
// Regenerates packages/contracts/{openapi.json,api-types.d.ts} from the
// FastAPI app's schema. Run from anywhere: `node packages/contracts/generate.mjs`.
// Requires apps/api/.venv to exist (see README) — the schema is produced by
// importing the app directly, no server needs to be running.
//
// CI runs this and fails on `git diff --exit-code` for the two generated
// files, so hand-written frontend types can't silently drift from the
// Pydantic models.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const apiDir = path.join(repo, "apps", "api");
const python = path.join(apiDir, ".venv", "bin", "python");
const schemaPath = path.join(here, "openapi.json");
const typesPath = path.join(here, "api-types.d.ts");

// The vendored engine prints a path notice on import, so write the JSON to a
// file from inside python rather than trusting stdout to be clean.
execFileSync(
  python,
  [
    "-c",
    `import json; from app.main import app; open(${JSON.stringify(schemaPath)}, "w").write(json.dumps(app.openapi(), indent=2, sort_keys=True) + "\\n")`,
  ],
  { cwd: apiDir, stdio: ["ignore", "ignore", "inherit"] },
);

const openapiTs = path.join(repo, "apps", "web", "node_modules", ".bin", "openapi-typescript");
execFileSync(openapiTs, [schemaPath, "-o", typesPath], { stdio: "inherit" });

console.log(`wrote ${path.relative(repo, schemaPath)} (${fs.statSync(schemaPath).size} bytes)`);
console.log(`wrote ${path.relative(repo, typesPath)} (${fs.statSync(typesPath).size} bytes)`);
