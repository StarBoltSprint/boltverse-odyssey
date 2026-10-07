/**
 * 720×1600 sprint clip. Monuments approach from the far band.
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

const frames = resolve("/tmp/wide-spawn-frames");
mkdirSync(frames, { recursive: true });
mkdirSync(here, { recursive: true });

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

const ctx = await browser.newContext({
  viewport: { width: 720, height: 1600 },
  deviceScaleFactor: 1,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("page", e.message));
writeFileSync("/tmp/wide-spawn-status.json", JSON.stringify({ phase: "open", at: Date.now() }));
await page.goto(`${base}/packs/corridor-ab/play/index.html?shot=film`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__corridor && window.__corridor.ready && window.__advance, null, { timeout: 240000 });

const seconds = 20;
const fps = 2;
const sim = 24;
const table = [];
let maxDraw = 0;
let maxTex = 0;
let maxVideos = 0;
let sawArch = false;
let sawGate = false;
let sawWreck = false;
let latLo = Infinity;
let latHi = -Infinity;
const plain = await page.evaluate(() => location.search.indexOf("adventure=1") === -1 && !(window.__corridor.adventure && window.__corridor.adventure.phase));

for (let sec = 0; sec < seconds; sec++) {
  const batch = await page.evaluate(({ sim, fps }) => {
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
        x: pose.x,
        z: pose.z,
        speed: pose.speed,
        live: pose.live,
        charge: pose.charge,
        drawCalls: draw ? c.drawCalls : 0,
        texMB: c.texMB,
        videos: c.activeVideos,
        counts: c.counts,
        monuments: c.monuments,
        adventure: c.adventure,
        draw,
        view: c.view,
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
    if (sample.videos > maxVideos) maxVideos = sample.videos;
    const counts = sample.counts || {};
    if (counts.arch > 0) sawArch = true;
    if (counts.gate > 0) sawGate = true;
    if (counts.wreck > 0) sawWreck = true;
    const mons = sample.monuments || [];
    for (let m = 0; m < mons.length; m++) {
      const side = mons[m].z - sample.z;
      if (side < latLo) latLo = side;
      if (side > latHi) latHi = side;
    }
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
    speed: last.speed,
    counts: last.counts,
    drawCalls: last.drawCalls,
    view: last.view,
  });
  writeFileSync("/tmp/wide-spawn-status.json", JSON.stringify({ sec, counts: last.counts, maxDraw, maxTex, maxVideos }));
}

await browser.close();
const enc = spawnSync("ffmpeg", [
  "-y", "-framerate", String(fps),
  "-i", resolve(frames, "f%04d.jpg"),
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "28",
  resolve(here, "sprint-wide.mp4"),
], { stdio: "inherit" });
if (enc.status !== 0) throw new Error("ffmpeg " + enc.status);

const report = {
  seconds,
  fps,
  view: table.length ? table[table.length - 1].view : null,
  plainUrl: plain,
  sawArch,
  sawGate,
  sawWreck,
  latLo: Number.isFinite(latLo) ? Math.round(latLo * 10) / 10 : null,
  latHi: Number.isFinite(latHi) ? Math.round(latHi * 10) / 10 : null,
  maxDraw,
  maxTex,
  maxVideos,
  table,
};
writeFileSync(resolve(here, "capture.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  sawArch, sawGate, sawWreck, latLo: report.latLo, latHi: report.latHi, maxDraw, maxTex, maxVideos, plain,
}, null, 2));
if (!sawArch || !sawGate || !sawWreck) process.exit(1);
if (!(report.latHi - report.latLo > 16)) process.exit(1);
if (maxDraw > 12 || maxTex > 260 || maxVideos > 4) process.exit(1);
if (!plain) process.exit(1);
