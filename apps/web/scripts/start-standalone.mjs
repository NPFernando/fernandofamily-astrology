import { spawn } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
let port = process.env.PORT;

for (let index = 0; index < args.length; index += 1) {
  if (args[index] !== "--port" && args[index] !== "-p") {
    throw new Error(`Unsupported start option: ${args[index]}`);
  }
  const value = args[index + 1];
  if (!value) throw new Error(`${args[index]} requires a port number`);
  port = value;
  index += 1;
}

if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
  throw new Error(`Invalid port: ${port}`);
}

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const server = fileURLToPath(new URL("../.next/standalone/apps/web/server.js", import.meta.url));
const standaloneRoot = dirname(server);

for (const [source, target] of [
  [join(appRoot, "public"), join(standaloneRoot, "public")],
  [join(appRoot, ".next", "static"), join(standaloneRoot, ".next", "static")],
]) {
  if (existsSync(source)) cpSync(source, target, { recursive: true, force: true });
}

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: { ...process.env, ...(port ? { PORT: port } : {}) },
});

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
