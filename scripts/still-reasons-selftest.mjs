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
console.log("STILL-REASONS PASS");
