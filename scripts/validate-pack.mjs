#!/usr/bin/env node
// Box check. Not Smoke (Bolt identity / clone).
// usage: node scripts/validate-pack.mjs packs/<id>
// exit 0 PASS, 1 FAIL

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node scripts/validate-pack.mjs packs/<id>");
  process.exit(2);
}

let fails = 0;
const pass = (m) => console.log("PASS  " + m);
const fail = (m) => {
  console.log("FAIL  " + m);
  fails++;
};

const STILLS = ["stills/spawn.jpg", "stills/at-a.jpg", "stills/at-b.jpg"];
const FILMS = [
  "films/breath-spawn.mp4",
  "films/breath-a.mp4",
  "films/breath-b.mp4",
  "films/walk-spawn-a.mp4",
  "films/walk-spawn-b.mp4",
];

const jsonPath = join(dir, "room.json");
if (!existsSync(jsonPath)) fail("room.json missing");
else {
  try {
    JSON.parse(readFileSync(jsonPath, "utf8"));
    pass("room.json");
  } catch {
    fail("room.json not JSON");
  }
}

for (const f of STILLS) existsSync(join(dir, f)) ? pass(f) : fail(f + " missing");
for (const f of FILMS) existsSync(join(dir, f)) ? pass(f) : fail(f + " missing");

function probe(file) {
  try {
    return JSON.parse(
      execFileSync(
        "ffprobe",
        ["-v", "error", "-show_streams", "-of", "json", file],
        { encoding: "utf8" },
      ),
    );
  } catch {
    return null;
  }
}

for (const f of FILMS) {
  const p = join(dir, f);
  if (!existsSync(p)) continue;
  const info = probe(p);
  if (!info) {
    fail(f + " ffprobe (install ffmpeg)");
    continue;
  }
  const streams = info.streams || [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  if (!v) fail(f + " no video");
  else {
    if (v.codec_name !== "h264") fail(f + " codec " + v.codec_name + " (need h264)");
    else pass(f + " h264");
    if (v.pix_fmt && v.pix_fmt !== "yuv420p") fail(f + " pix_fmt " + v.pix_fmt);
    else pass(f + " yuv420p");
    const w = Number(v.width);
    const h = Number(v.height);
    if (w !== 720 || h !== 1280) fail(f + " " + w + "x" + h + " (need 720x1280)");
    else pass(f + " 720x1280");
  }
  if (a) fail(f + " has audio (autoplay dies)");
  else pass(f + " no audio");
}

if (fails) {
  console.log("PACK FAIL  " + fails);
  process.exit(1);
}
console.log("PACK PASS");
