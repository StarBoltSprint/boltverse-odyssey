// tools/13 gate view: door-threshold renders from the phone page's own assets (mode B), fixed camera from views.json.
// node threshold_view.mjs <play_url> <out_dir> [view ...]
import { chromium } from "/workspace/playtest/node_modules/playwright/index.mjs";
import { readFileSync } from "node:fs";
const here = new URL(".", import.meta.url).pathname;
const VIEWS = JSON.parse(readFileSync(here + "views.json", "utf8"));
const [url, out, ...names] = process.argv.slice(2);
const DOOR = { x: -0.86, z: 0 };   // must match zd-play index.html DOOR
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const res = {};
for (const n of names.length ? names : Object.keys(VIEWS)) {
  const v = VIEWS[n];
  const ctx = await browser.newContext({ viewport: { width: v.css[0], height: v.css[1] }, deviceScaleFactor: v.dpr });
  const page = await ctx.newPage(); const logs = [];
  page.on("pageerror", (e) => logs.push(e.message));
  await page.route(/index\.html|\/(\?.*)?$/, async (route) => {
    const r = await route.fetch(); let html = await r.text();
    html = html.replace("lod.update(cam);", "if (window.__gcam) { const g = window.__gcam; cam.fov = g.fov; cam.updateProjectionMatrix(); cam.position.set(g.x, g.y, g.z); cam.rotation.set(g.pitch * Math.PI / 180, 0, 0, 'YXZ'); bolt.visible = false; } lod.update(cam);");
    if (!html.includes("window.__gcam")) throw new Error("patch point lod.update(cam) not found");
    await route.fulfill({ response: r, body: html, headers: { ...r.headers(), "content-type": "text/html" } });
  });
  await page.addInitScript((g) => { window.__gcam = g; }, { x: DOOR.x, y: v.up_m, z: DOOR.z + v.from_door_m, pitch: v.pitch_deg, fov: v.vfov_deg });
  await page.goto(url.replace(/\/?$/, "/") + "index.html?modeb=1&aa=1", { waitUntil: "load", timeout: 180000 });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  await page.addStyleTag({ content: "#hud,#bar,#stick{display:none!important}" });
  await page.waitForTimeout(2500);
  const p = `${out}/${n}.png`; await page.screenshot({ path: p, type: "png" });
  const size = await page.evaluate(() => { const c = document.querySelector("canvas"); return [c.width, c.height]; });
  res[n] = { path: p, canvas: size, view: v, errors: logs }; await ctx.close();
}
await browser.close(); console.log(JSON.stringify(res, null, 1));
