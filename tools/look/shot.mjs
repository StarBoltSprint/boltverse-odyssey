// One headless frame of the staging page. Viewport defaults to the phone (540x1200).
// A 16:9 gate frame passes its own width and height. SwiftShader. No live-file writes.
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";

const require = createRequire("/workspace/playtest/node_modules/playwright-core/package.json");
const { chromium } = require("playwright-core");
const chrome = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find((p) => existsSync(p));
if (!chrome) throw new Error("no chrome");

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] || 540);
const height = Number(process.argv[5] || 1200);
const dpr = Number(process.argv[6] || 1);
if (!url || !out) throw new Error("shot.mjs URL OUT [W H DPR]");

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-sandbox", "--hide-scrollbars", "--mute-audio"],
});
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: dpr,
  isMobile: height > width,
  hasTouch: height > width,
});
const page = await context.newPage();
page.setDefaultTimeout(180000);
const logs = [];
page.on("pageerror", (err) => logs.push(String(err && err.message ? err.message : err)));
page.on("console", (msg) => { if (msg.type() === "error") logs.push(msg.text().slice(0, 240)); });
let data = { ok: false };
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out, type: "png" });
  data = await page.evaluate(() => {
    const st = window.__st || {};
    const cam = window.__lookCtx && window.__lookCtx.camera;
    return {
      ok: true,
      look: window.__look || null,
      dpr: window.devicePixelRatio,
      size: [window.innerWidth, window.innerHeight],
      cam: { x: st.x, z: st.z, yaw: st.yaw, pitch: st.pitch, y: st.y },
      fov: cam ? cam.fov : null,
    };
  });
} catch (err) {
  data = { ok: false, reason: String(err && err.message ? err.message : err) };
}
data.logs = logs.slice(0, 8);
data.shot = out;
const sidecar = out.replace(/\.png$/, ".json");
writeFileSync(sidecar, JSON.stringify(data, null, 1));
console.log(JSON.stringify({ ok: data.ok, shot: out, size: data.size, fov: data.fov, look: data.look && data.look.on, reason: data.reason, logs: data.logs.slice(0, 3) }));
await browser.close();
if (!data.ok) process.exit(1);
