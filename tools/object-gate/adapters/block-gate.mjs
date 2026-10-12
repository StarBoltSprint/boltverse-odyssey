// Thin adapter. Shells python tools/gate. Not a page adapter.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function runGate(args) {
  const r = spawnSync("python3", ["-m", "tools.gate", ...args], { cwd: ROOT, encoding: "utf8" });
  return { status: r.status ?? 1, stdout: r.stdout, stderr: r.stderr };
}
