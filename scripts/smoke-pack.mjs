#!/usr/bin/env node
// Smoke = content lint. Box check is validate-pack.mjs.
// usage: node scripts/smoke-pack.mjs packs/<id>
// exit 0 SMOKE PASS, 1 FAIL
// Recook the FAIL clip only. Cap 2. Then ship last PASS. See SMOKE.md.

import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const dir = process.argv[2];
const skipBox = process.argv.includes("--skip-box");
if (!dir) {
  console.error("usage: node scripts/smoke-pack.mjs packs/<id>");
  process.exit(2);
}

let fails = 0;
const pass = (m) => console.log("PASS  " + m);
const warn = (m) => console.log("WARN  " + m);
const fail = (m) => {
  console.log("FAIL  " + m);
  fails++;
};
const hit = (required, m) => (required ? fail(m) : warn(m));

const SAME = 12;
const LOOP = 28;
const HW = 16;
const HH = 16;

function ffmpegBuf(args) {
  return execFileSync("ffmpeg", ["-v", "error", ...args], {
    encoding: "buffer",
    maxBuffer: 720 * 1280 * 3 + 4096,
  });
}

function ffmpegErr(args) {
  const r = spawnSync("ffmpeg", ["-hide_banner", ...args], { encoding: "utf8" });
  return (r.stderr || "") + (r.stdout || "");
}

function duration(file) {
  const err = ffmpegErr(["-i", file]);
  const m = err.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function rawFrame(file, ss, w, h) {
  const args = [];
  if (ss != null && ss > 0) args.push("-ss", ss.toFixed(3));
  args.push("-i", file, "-frames:v", "1", "-vf", `scale=${w}:${h}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1");
  const buf = ffmpegBuf(args);
  if (!buf || buf.length < w * h * 3) throw new Error("short frame");
  return buf.subarray(0, w * h * 3);
}

function aHash(buf, w = HW, h = HH) {
  const n = w * h;
  const lum = new Uint8Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = (buf[i * 3] * 3 + buf[i * 3 + 1] * 4 + buf[i * 3 + 2]) >> 3;
    lum[i] = v;
    sum += v;
  }
  const avg = sum / n;
  let bits = 0n;
  for (let i = 0; i < n; i++) if (lum[i] >= avg) bits |= 1n << BigInt(i);
  return bits;
}

function hamming(a, b) {
  let x = a ^ b;
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

function frameHash(file, ss) {
  return aHash(rawFrame(file, ss, HW, HH));
}

function lastSs(file) {
  const d = duration(file);
  return d > 0.2 ? d - 0.08 : 0;
}

function whiteBlobs(buf, w, h) {
  const vis = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    vis[i] = mn > 150 && mx - mn < 55 ? 1 : 0;
  }
  const y0 = Math.floor(h * 0.28);
  const seen = new Uint8Array(w * h);
  const minA = Math.floor(w * h * 0.008);
  let blobs = 0;
  const flood = (sx, sy) => {
    const st = [[sx, sy]];
    let area = 0;
    while (st.length) {
      const [x, y] = st.pop();
      if (x < 0 || y < y0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (seen[i] || !vis[i]) continue;
      seen[i] = 1;
      area++;
      st.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return area;
  };
  for (let y = y0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (vis[i] && !seen[i] && flood(x, y) >= minA) blobs++;
    }
  }
  return blobs;
}

function cloneScan(file) {
  const d = duration(file);
  const step = d > 8 ? 1.2 : 0.8;
  let max = 0;
  for (let t = 0; t < d; t += step) {
    try {
      const n = whiteBlobs(rawFrame(file, t, 90, 160), 90, 160);
      if (n > max) max = n;
      if (n >= 2) return n;
    } catch {
      /* skip */
    }
  }
  return max;
}

const WALKS = [
  ["films/walk-spawn-a.mp4", "stills/spawn.jpg", "stills/at-a.jpg", true],
  ["films/walk-spawn-b.mp4", "stills/spawn.jpg", "stills/at-b.jpg", true],
  ["films/walk-a-b.mp4", "stills/at-a.jpg", "stills/at-b.jpg", false],
  ["films/walk-b-a.mp4", "stills/at-b.jpg", "stills/at-a.jpg", false],
];

const BREATHS = ["films/breath-spawn.mp4", "films/breath-a.mp4", "films/breath-b.mp4"];

const ENTERS = [
  ["films/enter-hall-a.mp4", "stills/a/spawn.jpg", false],
  ["films/enter-a-hall.mp4", "stills/spawn.jpg", false],
  ["films/enter-hall-b.mp4", "stills/b/spawn.jpg", false],
  ["films/enter/a-to-b.mp4", "stills/b/spawn.jpg", false],
  ["films/enter-a-b.mp4", "stills/b/spawn.jpg", false],
];

if (!skipBox) {
  const here = dirname(fileURLToPath(import.meta.url));
  const box = join(here, "validate-pack.mjs");
  if (existsSync(box)) {
    const r = spawnSync(process.execPath, [box, dir], { encoding: "utf8" });
    process.stdout.write(r.stdout || "");
    process.stderr.write(r.stderr || "");
    if (r.status !== 0) {
      console.log("SMOKE FAIL  box");
      process.exit(1);
    }
  }
}

for (const file of BREATHS) {
  const p = join(dir, file);
  if (!existsSync(p)) continue;
  try {
    const ham = hamming(frameHash(p, 0), frameHash(p, lastSs(p)));
    if (ham > LOOP) fail(file + " breath walked (first/last ham " + ham + ")");
    else pass(file + " loop ham " + ham);
    const dogs = cloneScan(p);
    if (dogs >= 2) fail(file + " clone (" + dogs + " dogs)");
    else pass(file + " one dog");
  } catch (e) {
    fail(file + " " + e.message);
  }
}

for (const [file, startStill, endStill, required] of WALKS) {
  const p = join(dir, file);
  if (!existsSync(p)) continue;
  try {
    const first = frameHash(p, 0);
    const last = frameHash(p, lastSs(p));
    const ham = hamming(first, last);
    if (ham < SAME) hit(required, file + " first=last (ham " + ham + ") — not a walk");
    else pass(file + " first≠last ham " + ham);
    if (existsSync(join(dir, startStill)) && existsSync(join(dir, endStill))) {
      const s = frameHash(join(dir, startStill), 0);
      const e = frameHash(join(dir, endStill), 0);
      if (hamming(first, s) > hamming(first, e) + 8) hit(required, file + " first closer to end still than start");
      else pass(file + " first~start");
      if (hamming(last, e) > hamming(last, s) + 8) hit(required, file + " last closer to start still than end");
      else pass(file + " last~end");
    }
    const dogs = cloneScan(p);
    if (dogs >= 2) hit(required, file + " clone (" + dogs + " dogs)");
    else pass(file + " one dog");
  } catch (e) {
    hit(required, file + " " + e.message);
  }
}

for (const [file, destStill, required] of ENTERS) {
  const p = join(dir, file);
  if (!existsSync(p)) continue;
  try {
    const first = frameHash(p, 0);
    const last = frameHash(p, lastSs(p));
    const ham = hamming(first, last);
    if (ham < SAME) hit(required, file + " first=last (ham " + ham + ")");
    else pass(file + " first≠last ham " + ham);
    if (existsSync(join(dir, destStill))) {
      const dest = frameHash(join(dir, destStill), 0);
      if (hamming(last, dest) < SAME) hit(required, file + " last=Hall' spawn (clone bait)");
      else pass(file + " last≠dest spawn");
    }
    const dogs = cloneScan(p);
    if (dogs >= 2) hit(required, file + " clone (" + dogs + " dogs)");
    else pass(file + " one dog");
  } catch (e) {
    hit(required, file + " " + e.message);
  }
}

if (fails) {
  console.log("SMOKE FAIL  " + fails + "  recook that clip, cap 2");
  process.exit(1);
}
console.log("SMOKE PASS");
