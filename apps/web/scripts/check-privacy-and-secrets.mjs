import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const ignored = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".woff", ".woff2", ".pdf", ".zip"]);
const patterns = [
  { name: "private key", expression: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "GitHub token", expression: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
  { name: "AWS access key", expression: /AKIA[0-9A-Z]{16}/ },
  { name: "Slack token", expression: /xox[baprs]-[A-Za-z0-9-]{20,}/ },
  { name: "npm token", expression: /npm_[A-Za-z0-9]{30,}/ },
];

const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: repoRoot, encoding: "buffer" })
  .toString()
  .split("\0")
  .filter(Boolean);
const findings = [];

for (const file of files) {
  if (file.startsWith("apps/api/vendor/") || file.includes("node_modules/")) continue;
  if (ignored.has(path.extname(file).toLowerCase())) continue;
  const absolute = path.join(repoRoot, file);
  let content;
  try {
    content = readFileSync(absolute, "utf8");
  } catch {
    continue;
  }
  for (const { name, expression } of patterns) {
    if (expression.test(content)) findings.push(`${file}: possible ${name}`);
  }
}

if (findings.length) {
  console.error(`Privacy/secret scan failed:\n${findings.join("\n")}`);
  process.exit(1);
}
console.log(`Privacy/secret scan passed: ${files.length} tracked or pending files checked.`);
