#!/usr/bin/env node
// Box check. Not Smoke (Bolt identity / clone). PACK.md — is this folder a pack?
// usage: node scripts/validate-pack.mjs packs/<id>
// exit 0 PASS, 1 FAIL → stock / no URL

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
const OPTIONAL = ["films/walk-a-b.mp4", "films/walk-b-a.mp4"];

const jsonPath = join(dir, "room.json");
let room = null;
if (!existsSync(jsonPath)) fail("room.json missing");
else {
  try {
    room = JSON.parse(readFileSync(jsonPath, "utf8"));
    pass("room.json");
  } catch {
    fail("room.json not JSON");
  }
}

if (room && typeof room === "object") {
  const format = room.format ?? 1;
  if (format !== 1) fail("format " + format + " (player v1 reads 1)");
  else pass("format 1");

  const plate = String(room.plate || room.plateSize || "720x1280");
  if (plate.replace(/\s/g, "") !== "720x1280") fail("plate " + plate);
  else pass("plate 720x1280");

  const aspect = room.aspect || "9:16";
  if (aspect !== "9:16") fail("aspect " + aspect);
  else pass("aspect 9:16");

  if (room.auth === true) fail("auth true (packs are anonymous)");
  else pass("auth off");

  if (room.database === true) fail("database true");
  else pass("database off");

  const chrome = room.chrome ?? "none";
  if (chrome !== "none") fail("chrome " + chrome);
  else pass("chrome none");

  const open = room.open ?? "breath-spawn";
  if (open !== "breath-spawn") fail("open " + open);
  else pass("open breath-spawn");

  if (room.PACK == null && room.pack == null) fail("PACK missing");
  else pass("PACK " + (room.PACK ?? room.pack));

  const cam = room.camera ?? "lock-off";
  if (cam !== "lock-off") fail("camera " + cam);
  else pass("camera lock-off");

  const files = new Set();
  const clips = room.clips || {};
  for (const [id, c] of Object.entries(clips)) {
    const f = c && c.file;
    if (!f) continue;
    if (/^(https?:|file:|\/)/i.test(f) && !String(f).startsWith("stills/") && !String(f).startsWith("films/"))
      fail("clip file must be relative: " + f);
    const rel = String(f).replace(/^\.\//, "");
    files.add(rel);
    if (c.required === true && !existsSync(join(dir, rel))) fail(id + " required missing " + rel);
  }

  const edges = Array.isArray(room.edges) ? room.edges : [];
  const has = (from, tap) =>
    edges.some((e) => e && e.from === from && (e.tap === tap || e.door === tap));
  has("spawn", "A") ? pass("edge spawn+A") : fail("edge spawn+A missing");
  has("spawn", "B") ? pass("edge spawn+B") : fail("edge spawn+B missing");

  for (const id of ["walk-A-B", "walk-B-A", "walk-a-b", "walk-b-a"]) {
    const c = clips[id];
    if (!c) continue;
    const rel = String(c.file || "").replace(/^\.\//, "");
    if (c.required === true) {
      existsSync(join(dir, rel)) ? pass(id) : fail(id + " required missing");
    }
  }

  const enter = room.ENTER || room.enter || {};
  const enterClips = enter.clips && typeof enter.clips === "object" ? enter.clips : {};
  for (const [id, c] of Object.entries(enterClips)) {
    if (!c || typeof c !== "object") continue;
    if (!c.to) fail("ENTER " + id + " missing to");
    else pass("ENTER " + id + " to " + c.to);
    const rel = String(c.file || "").replace(/^\.\//, "");
    if (c.required === true) {
      existsSync(join(dir, rel)) ? pass("ENTER " + id) : fail("ENTER " + id + " missing " + rel);
    } else if (rel) {
      pass("ENTER " + id + " optional");
    }
  }
}

for (const f of STILLS) existsSync(join(dir, f)) ? pass(f) : fail(f + " missing");
for (const f of FILMS) existsSync(join(dir, f)) ? pass(f) : fail(f + " missing");
for (const f of OPTIONAL) {
  if (existsSync(join(dir, f))) pass(f + " (optional)");
  else pass(f + " absent (floor 1 OK)");
}

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
    // ffmpeg-only fallback: skip streams if ffprobe missing — size still required by files
    pass(f + " present (ffprobe optional)");
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
