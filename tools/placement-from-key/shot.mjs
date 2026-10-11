// One staging frame. Writes a png and a json sidecar (camera, draw calls, triangles).
import { createRequire } from "node:module";
import { existsSync, writeFileSync } from "node:fs";

const require = createRequire("/workspace/playtest/node_modules/playwright-core/package.json");
const { chromium } = require("playwright-core");
const chrome = ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium"].find((p) => existsSync(p));
if (!chrome) throw new Error("no chrome");

const url = process.argv[2];
const out = process.argv[3];
const width = Number(process.argv[4] || 1280);
const height = Number(process.argv[5] || 720);
if (!url || !out) throw new Error("shot.mjs URL OUT [W H]");

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--disable-gpu-sandbox", "--hide-scrollbars", "--mute-audio"],
});
const context = await browser.newContext({
  viewport: { width, height },
  deviceScaleFactor: 1,
  isMobile: height > width,
  hasTouch: height > width,
});
const page = await context.newPage();
page.setDefaultTimeout(180000);
const logs = [];
page.on("pageerror", (err) => logs.push(String(err && err.message ? err.message : err)));
page.on("console", (msg) => { if (msg.type() === "error") logs.push(msg.text().slice(0, 240)); });
page.on("response", (res) => { if (res.status() >= 400) logs.push(res.status() + " " + res.url()); });
let data = { ok: false };
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.waitForTimeout(2200);
  await page.screenshot({ path: out, type: "png" });
  data = await page.evaluate(() => {
    const st = window.__st || {};
    const r = window.__gdProf && window.__gdProf.renderer;
    const info = r && r.info && r.info.render ? r.info.render : {};
    const mem = r && r.info && r.info.memory ? r.info.memory : {};
    return {
      ok: true,
      dpr: window.devicePixelRatio,
      size: [window.innerWidth, window.innerHeight],
      cam: { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch },
      drawCalls: info.calls ?? null,
      triangles: info.triangles ?? null,
      geometries: mem.geometries ?? null,
      textures: mem.textures ?? null,
    };
  });
} catch (err) {
  data = { ok: false, reason: String(err && err.message ? err.message : err) };
}
data.logs = logs.slice(0, 8);
data.shot = out;
writeFileSync(out.replace(/\.png$/, ".json"), JSON.stringify(data, null, 1));
console.log(JSON.stringify({ ok: data.ok, shot: out, cam: data.cam, drawCalls: data.drawCalls, triangles: data.triangles, reason: data.reason, logs: (data.logs || []).slice(0, 3) }));
await browser.close();
if (!data.ok) process.exit(1);
