/**
 * Portrait proofs for the corridor sprint.
 * usage: node capture.mjs http://127.0.0.1:8765
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../../../..");
const playcheck = resolve(repo, "tools/playcheck");
const { chromium } = createRequire(resolve(playcheck, "package.json"))("playwright-core");
const chrome = ["/opt/google/chrome/chrome", "/usr/bin/google-chrome"].find((p) => existsSync(p));
const base = process.argv[2];
if (!base || !chrome) {
  console.log("usage: node capture.mjs <baseUrl>");
  process.exit(2);
}

const out = here;
mkdirSync(out, { recursive: true });
const frames = resolve("/tmp/corridor-sprint-frames");
mkdirSync(frames, { recursive: true });

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-component-extensions-with-background-pages",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
  ],
});

function saveShot(page, file) {
  return page.evaluate(async (fileName) => {
    const canvas = document.getElementById("view");
    const url = canvas.toDataURL("image/jpeg", 0.72);
    return { url, w: canvas.width, h: canvas.height, fileName };
  }, file).then((shot) => {
    const buf = Buffer.from(shot.url.split(",")[1], "base64");
    writeFileSync(resolve(out, shot.fileName), buf);
    return { w: shot.w, h: shot.h, bytes: buf.length };
  });
}

const ctx = await browser.newContext({
  viewport: { width: 720, height: 1600 },
  deviceScaleFactor: 1,
  hasTouch: true,
});

const zone = await ctx.newPage();
zone.on("pageerror", (e) => console.log("zone", e.message));
await zone.goto(`${base}/packs/zone-a/play/index.html`, { waitUntil: "domcontentloaded", timeout: 120000 });
await zone.waitForFunction(() => window.__play && (window.__play.ready || window.__play.error), null, { timeout: 180000 });
const zoneErr = await zone.evaluate(() => window.__play.error || null);
if (zoneErr) throw new Error("zone A " + zoneErr);
await zone.evaluate(() => window.__play.tick(1 / 30));
const zoneMeasure = await zone.evaluate(() => {
  const s = window.__play.camState();
  const eye = s.eye;
  const fwd = s.fwd;
  const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
  const f = [fwd[0] / fl, fwd[1] / fl, fwd[2] / fl];
  const up = [0, 1, 0];
  let rx = up[1] * f[2] - up[2] * f[1];
  let ry = up[2] * f[0] - up[0] * f[2];
  let rz = up[0] * f[1] - up[1] * f[0];
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  let ux = f[1] * rz - f[2] * ry;
  let uy = f[2] * rx - f[0] * rz;
  let uz = f[0] * ry - f[1] * rx;
  const ul = Math.hypot(ux, uy, uz) || 1;
  ux /= ul; uy /= ul; uz /= ul;
  const px = s.x;
  const py = s.feet + 1.05;
  const pz = s.z;
  const dx = px - eye[0];
  const dy = py - eye[1];
  const dz = pz - eye[2];
  const vx = dx * rx + dy * ry + dz * rz;
  const vy = dx * ux + dy * uy + dz * uz;
  const vz = dx * f[0] + dy * f[1] + dz * f[2];
  const hfov = 22.7 * Math.PI / 180;
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / (720 / 1600));
  const ndcX = (vx / vz) / Math.tan(hfov / 2);
  const ndcY = (vy / vz) / Math.tan(vfov / 2);
  return {
    screen: [(ndcX * 0.5 + 0.5), (0.5 - ndcY * 0.5)],
    boom: s.boom,
    eyeY: eye[1],
    feet: s.feet,
    pitch: s.pitch,
  };
});
const zoneShot = await saveShot(zone, "zone-a-720.jpg");
await zone.close();

const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("corridor", e.message));
await page.goto(`${base}/packs/corridor-ab/play/index.html?shot=sprint`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__corridor && window.__corridor.ready, null, { timeout: 180000 });
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const corridorStill = await page.evaluate(() => ({
  screen: window.__corridor.boltScreen,
  view: window.__corridor.view,
  boom: window.__corridor.boom,
  eyeY: window.__corridor.eyeY,
  pitch: window.__corridor.pitch,
  drawCalls: window.__corridor.drawCalls,
  texMB: window.__corridor.texMB,
  live: window.__corridor.live,
  speed: window.__corridor.speed,
}));
const stillShot = await saveShot(page, "corridor-720.jpg");
await page.close();

const run = await ctx.newPage();
run.on("pageerror", (e) => console.log("run", e.message));
await run.goto(`${base}/packs/corridor-ab/play/index.html?shot=film`, { waitUntil: "domcontentloaded", timeout: 120000 });
await run.waitForFunction(() => window.__corridor && window.__corridor.ready && window.__advance, null, { timeout: 180000 });
const seconds = 60;
const fps = 2;
const sim = 24;
const table = [];
let maxDraw = 0;
let maxTex = 0;
let minLive = Infinity;
let maxDrop = 0;
let prevLive = 0;
let prevX = null;
let prevZ = null;
let maxJump = 0;
for (let sec = 0; sec < seconds; sec++) {
  const batch = await run.evaluate(({ sim, fps }) => {
    const rows = [];
    const urls = [];
    const canvas = document.getElementById("view");
    for (let k = 0; k < sim; k++) {
      const draw = k % Math.round(sim / fps) === 0;
      window.__nodraw = !draw;
      window.__advance();
      const pose = window.__pose;
      const c = window.__corridor;
      rows.push({
        x: pose.x, z: pose.z, speed: pose.speed, live: pose.live, charge: pose.charge,
        drawCalls: draw ? c.drawCalls : 0, texMB: c.texMB, screen: draw ? c.boltScreen : null,
        heading: pose.heading, draw,
      });
      if (draw) urls.push(canvas.toDataURL("image/jpeg", 0.62));
    }
    window.__nodraw = false;
    return { rows, urls };
  }, { sim, fps });
  let urlI = 0;
  for (let k = 0; k < batch.rows.length; k++) {
    const sample = batch.rows[k];
    if (sample.drawCalls > maxDraw) maxDraw = sample.drawCalls;
    if (sample.texMB > maxTex) maxTex = sample.texMB;
    if (prevX != null) {
      const jump = Math.hypot(sample.x - prevX, sample.z - prevZ);
      const allow = Math.max(0.05, sample.speed) * (1 / sim) * 1.5;
      if (jump > maxJump) maxJump = jump;
      if (jump > allow + 0.05) throw new Error("jump " + jump.toFixed(2) + " at " + sec + " step " + k);
    }
    prevX = sample.x;
    prevZ = sample.z;
    if (sec > 1 || k > 30) {
      const drop = prevLive - sample.live;
      if (drop > maxDrop) maxDrop = drop;
      if (sample.live < minLive) minLive = sample.live;
    }
    prevLive = sample.live;
    if (sample.draw) {
      const buf = Buffer.from(batch.urls[urlI].split(",")[1], "base64");
      urlI += 1;
      const n = sec * fps + urlI - 1;
      writeFileSync(resolve(frames, "f" + String(n).padStart(4, "0") + ".jpg"), buf);
    }
  }
  const last = batch.rows[batch.rows.length - 1];
  table.push({
    t: sec + 1,
    x: Math.round(last.x * 10) / 10,
    z: Math.round(last.z * 100) / 100,
    speed: last.speed,
    live: last.live,
    charge: Math.round(last.charge * 100) / 100,
    screenY: last.screen ? Math.round(last.screen[1] * 1000) / 1000 : null,
    heading: Math.round(last.heading),
  });
  writeFileSync("/tmp/corridor-capture-status.json", JSON.stringify({ sec, table: table[table.length - 1], minLive, maxDrop, maxJump }));
}
await run.close();
await browser.close();

const enc = spawnSync("ffmpeg", [
  "-y", "-framerate", String(fps),
  "-i", resolve(frames, "f%04d.jpg"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28",
  resolve(out, "sprint-60s.mp4"),
], { stdio: "inherit" });
if (enc.status !== 0) throw new Error("ffmpeg " + enc.status);

const side = spawnSync("ffmpeg", [
  "-y",
  "-i", resolve(out, "zone-a-720.jpg"),
  "-i", resolve(out, "corridor-720.jpg"),
  "-filter_complex", "hstack",
  resolve(out, "side-by-side-720.jpg"),
], { stdio: "inherit" });
if (side.status !== 0) throw new Error("hstack " + side.status);

const dy = Math.abs((corridorStill.screen ? corridorStill.screen[1] : 1) - zoneMeasure.screen[1]);
const report = {
  zoneA: { ...zoneMeasure, shot: zoneShot },
  corridor: { ...corridorStill, shot: stillShot },
  screenYDelta: dy,
  run: { seconds, fps, minLive, maxDrop, maxJump, maxDraw, maxTex, table },
};
writeFileSync(resolve(out, "capture.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  screenYDelta: dy,
  zoneY: zoneMeasure.screen[1],
  corridorY: corridorStill.screen && corridorStill.screen[1],
  zoneBoom: zoneMeasure.boom,
  zoneEye: zoneMeasure.eyeY,
  corridorBoom: corridorStill.boom,
  corridorEye: corridorStill.eyeY,
  minLive, maxDrop, maxJump, maxDraw, maxTex,
}, null, 2));
if (dy > 0.03) process.exit(1);
if (minLive <= 0 || maxDrop > 4) process.exit(1);
if (maxDraw > 12) process.exit(1);
