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
const visibleChargement = () => page.evaluate(() => {
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    let direct = "";
    for (const n of el.childNodes) if (n.nodeType === 3) direct += n.textContent || "";
    if (/chargement/i.test(direct)) return direct.trim().slice(0, 80);
  }
  return "";
});
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.waitForTimeout(350);
  const earlyText = await visibleChargement();
  const earlyPath = out.replace(/\.png$/, "-loading.png");
  if (earlyText) await page.screenshot({ path: earlyPath, type: "png" });
  await page.waitForFunction(() => {
    if (window.__ready !== true) return false;
    for (const el of document.querySelectorAll("body *")) {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      let direct = "";
      for (const n of el.childNodes) if (n.nodeType === 3) direct += n.textContent || "";
      if (/chargement/i.test(direct)) return false;
    }
    return true;
  }, null, { timeout: 180000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out, type: "png" });
  data = await page.evaluate(() => {
    const st = window.__st || {};
    const r = window.__gdProf && window.__gdProf.renderer;
    const info = r && r.info && r.info.render ? r.info.render : {};
    const mem = r && r.info && r.info.memory ? r.info.memory : {};
    const names = {};
    const world = window.__gdProf && window.__gdProf.world;
    if (world) world.traverse((o) => {
      if (!o.visible || !(o.isMesh || o.isInstancedMesh)) return;
      const key = o.name || o.type;
      names[key] = (names[key] || 0) + 1;
    });
    const passes = window.__measurePasses ? window.__measurePasses() : null;
    return {
      ok: true,
      dpr: window.devicePixelRatio,
      size: [window.innerWidth, window.innerHeight],
      cam: { x: st.x, y: st.y, z: st.z, yaw: st.yaw, pitch: st.pitch },
      drawCalls: info.calls ?? null,
      triangles: info.triangles ?? null,
      geometries: mem.geometries ?? null,
      textures: mem.textures ?? null,
      passes,
      visible: names,
    };
  });
  data.loadingText = earlyText;
  data.loadingShot = earlyText ? earlyPath : null;
} catch (err) {
  data = { ok: false, reason: String(err && err.message ? err.message : err) };
}
data.logs = logs.slice(0, 8);
data.shot = out;
writeFileSync(out.replace(/\.png$/, ".json"), JSON.stringify(data, null, 1));
console.log(JSON.stringify({ ok: data.ok, shot: out, cam: data.cam, drawCalls: data.drawCalls, triangles: data.triangles, reason: data.reason, logs: (data.logs || []).slice(0, 3) }));
await browser.close();
if (!data.ok) process.exit(1);
