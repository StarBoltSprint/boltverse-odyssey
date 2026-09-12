#!/usr/bin/env node
// Fixture: hung moss stills PASS sit/yaw; a size-in-band loaf FAILs gate.sit.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stillReasons, GW, GH } from "./still-pair.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function raw(file) {
  const buf = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      file,
      "-frames:v",
      "1",
      "-vf",
      `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,scale=${GW}:${GH}`,
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { encoding: "buffer", maxBuffer: 720 * 1280 * 3 + 8192 },
  );
  return buf.subarray(0, GW * GH * 3);
}

function mustPass(rel, kind) {
  const r = stillReasons(raw(join(root, rel)), kind);
  if (r.why.length) {
    console.error("FAIL  " + rel + "  " + r.why.join("; "));
    process.exit(1);
  }
  console.log("PASS  " + rel);
}

mustPass("packs/moss/stills/spawn.jpg", "still-spawn");
mustPass("packs/moss/stills/at-a.jpg", "still-atA");
mustPass("packs/moss/stills/at-b.jpg", "still-atB");

const sit = Buffer.alloc(GW * GH * 3, 40);
const y0 = Math.floor(GH * 0.52);
const y1 = Math.floor(GH * 0.89);
const x0 = Math.floor(GW * 0.12);
const x1 = Math.floor(GW * 0.48);
for (let y = y0; y < y1; y++) {
  for (let x = x0; x < x1; x++) {
    const i = (y * GW + x) * 3;
    sit[i] = 210;
    sit[i + 1] = 205;
    sit[i + 2] = 198;
  }
}
const loaf = stillReasons(sit, "still-atB");
if (!loaf.why.some((w) => w.startsWith("gate.sit"))) {
  console.error("FAIL  synthetic sit-in-band should gate.sit  " + JSON.stringify(loaf));
  process.exit(1);
}
console.log("PASS  synthetic sit-in-band  " + loaf.why.join("; "));

function paintStanding(muzzle) {
  const buf = Buffer.alloc(GW * GH * 3, 40);
  const y0 = Math.floor(GH * 0.5);
  const y1 = Math.floor(GH * 0.87);
  const x0 = Math.floor(GW * 0.62);
  const x1 = Math.floor(GW * 0.74);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * GW + x) * 3;
      buf[i] = 210;
      buf[i + 1] = 205;
      buf[i + 2] = 198;
    }
  }
  if (muzzle) {
    const my0 = y0 + 4;
    const my1 = y0 + Math.floor((y1 - y0) * 0.32);
    const mx0 = x0 + Math.floor((x1 - x0) * 0.28);
    const mx1 = x0 + Math.floor((x1 - x0) * 0.72);
    for (let y = my0; y < my1; y++) {
      for (let x = mx0; x < mx1; x++) {
        const i = (y * GW + x) * 3;
        buf[i] = 70;
        buf[i + 1] = 60;
        buf[i + 2] = 55;
      }
    }
  }
  return buf;
}

const face = stillReasons(paintStanding(true), "still-atB");
if (!face.why.some((w) => w.startsWith("identity.face"))) {
  console.error("FAIL  synthetic face-in-band should identity.face  " + JSON.stringify(face.why));
  process.exit(1);
}
console.log("PASS  synthetic face-in-band  " + face.why.join("; "));

const back = stillReasons(paintStanding(false), "still-atB");
if (back.why.some((w) => w.startsWith("identity.face") || w.startsWith("gate.sit") || w.startsWith("gate.yaw"))) {
  console.error("FAIL  synthetic back-in-band should pass sit/yaw/face  " + JSON.stringify(back.why));
  process.exit(1);
}
console.log("PASS  synthetic back-in-band");

function paintStandingAt(x0f, x1f) {
  const buf = Buffer.alloc(GW * GH * 3, 40);
  const y0 = Math.floor(GH * 0.5);
  const y1 = Math.floor(GH * 0.87);
  const x0 = Math.floor(GW * x0f);
  const x1 = Math.floor(GW * x1f);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * GW + x) * 3;
      buf[i] = 210;
      buf[i + 1] = 205;
      buf[i + 2] = 198;
    }
  }
  return buf;
}

const midHall = paintStandingAt(0.44, 0.56);
for (const kind of ["still-atA", "still-atB"]) {
  const mid = stillReasons(midHall, kind);
  if (!mid.why.some((w) => w.startsWith("gate.place"))) {
    console.error("FAIL  synthetic mid-hall should gate.place on " + kind + "  " + JSON.stringify(mid.why));
    process.exit(1);
  }
  if (mid.why.some((w) => w.startsWith("gate.sit") || w.startsWith("gate.yaw") || w.startsWith("identity.face"))) {
    console.error("FAIL  synthetic mid-hall must not loosen sit/yaw/face  " + JSON.stringify(mid.why));
    process.exit(1);
  }
  console.log("PASS  synthetic mid-hall " + kind + "  " + mid.why.join("; "));
}

const leftSill = stillReasons(paintStandingAt(0.14, 0.28), "still-atA");
if (leftSill.why.some((w) => w.startsWith("gate.place") || w.startsWith("gate.sit") || w.startsWith("gate.yaw") || w.startsWith("identity.face"))) {
  console.error("FAIL  synthetic left-sill should pass place/sit/yaw/face  " + JSON.stringify(leftSill.why));
  process.exit(1);
}
console.log("PASS  synthetic left-sill still-atA");

const leftAsB = stillReasons(paintStandingAt(0.14, 0.28), "still-atB");
if (!leftAsB.why.some((w) => w.startsWith("gate.place"))) {
  console.error("FAIL  synthetic left-sill as still-atB should gate.place  " + JSON.stringify(leftAsB.why));
  process.exit(1);
}
console.log("PASS  synthetic left-sill as still-atB  " + leftAsB.why.join("; "));

console.log("STILL-REASONS PASS");
