/**
 * Render the zone loader against the live preview and write the verify report.
 *   node tools/world-graph/verify.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { statSync, mkdirSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

const PREVIEW = "/workspace/zb-preview-1008";
const ROOT = new URL("../..", import.meta.url).pathname;
const OUT = ROOT + "steps/world-graph-1011/verify-report.json";
const SHOTS = ROOT + "steps/world-graph-1011/shots";
mkdirSync(SHOTS, { recursive: true });

function stamp() {
  return ["index.html", "main.mjs"].map((f) => {
    const s = statSync(PREVIEW + "/" + f);
    return { f, size: s.size, mtimeMs: s.mtimeMs };
  });
}
const before = stamp();

const server = spawn(process.execPath, [ROOT + "tools/world-graph/serve.mjs"], { stdio: ["ignore", "pipe", "pipe"] });
const port = await new Promise((resolve, reject) => {
  const rl = createInterface({ input: server.stdout });
  const t = setTimeout(() => reject(new Error("server did not print PORT")), 10000);
  rl.on("line", (line) => {
    const m = line.match(/^PORT (\d+)$/);
    if (m) { clearTimeout(t); resolve(Number(m[1])); }
  });
  server.on("exit", (code) => reject(new Error("server exit " + code)));
});
console.log("server", port);

const cdpPort = 9333;
const chrome = spawn("/usr/bin/google-chrome", [
  "--headless=new",
  "--remote-debugging-port=" + cdpPort,
  "--user-data-dir=/tmp/wg-chrome-profile",
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-webgl",
  "--ignore-gpu-blocklist",
  "--remote-allow-origins=*",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1280,800",
  "about:blank",
], { stdio: "ignore" });

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
let up = false;
for (let i = 0; i < 50; i++) {
  try {
    const r = await fetch("http://127.0.0.1:" + cdpPort + "/json/version");
    if (r.ok) { up = true; break; }
  } catch {}
  await sleep(200);
}
if (!up) {
  chrome.kill("SIGKILL");
  server.kill("SIGKILL");
  throw new Error("chrome debugger did not come up");
}

const py = spawnSync("python3", [
  ROOT + "tools/world-graph/capture.py",
  "--port", String(port),
  "--cdp", String(cdpPort),
  "--out", OUT,
  "--shots", SHOTS,
], { encoding: "utf8", timeout: 600000 });
chrome.kill("SIGTERM");
server.kill("SIGTERM");
process.stdout.write(py.stdout || "");
process.stderr.write(py.stderr || "");
const after = stamp();
if (JSON.stringify(before) !== JSON.stringify(after)) {
  console.error("FAIL live preview files changed");
  process.exit(1);
}
if (py.status !== 0) {
  console.error("FAIL capture exit " + py.status);
  process.exit(py.status || 1);
}
const report = JSON.parse(readFileSync(OUT, "utf8"));
const limit = 1 / 255;
let bad = false;
for (const name of ["hero", "street", "m8"]) {
  const row = report.pixelDiff[name];
  const ok = row.meanAbs <= limit && row.refLuma > 0.05;
  console.log((ok ? "PASS" : "FAIL") + ` pixel ${name} meanAbs=${row.meanAbs} luma=${row.refLuma}`);
  if (!ok) bad = true;
}
if (!report.heroDiffersFromStreet) {
  console.log("FAIL hero frame matches the street frame");
  bad = true;
}
const k = report.keyCamera;
console.log(`key SSIM=${k.ssim} LPIPS=${k.lpips} drawCalls=${k.drawCalls} triangles=${k.triangles}`);
if (k.ssim == null || k.lpips == null || k.drawCalls == null || k.triangles == null) bad = true;
if (bad) process.exit(1);
console.log("PASS verify");
console.log("preview unchanged");
