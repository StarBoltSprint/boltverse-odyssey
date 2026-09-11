#!/usr/bin/env node
/**
 * Lane smoke. NOT smoke-pack (hall).
 *   node scripts/smoke-biome.mjs forest
 *   node scripts/smoke-biome.mjs biomes/forest
 *
 * Per plate: metal → validate-cues → smokeL (if samples) → extract 3 frames for identity C.
 * FAIL a required plate (decay) → kit stays coming. Do not Hang the door.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { smokeL } from "./cue-readability.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const arg = String(process.argv[2] || "").trim();
if (!arg) {
  console.error("usage: node scripts/smoke-biome.mjs forest");
  process.exit(2);
}

const id = arg.replace(/^.*\//, "").replace(/-palette\.json$/, "");
const palPath = existsSync(arg)
  ? arg
  : existsSync(join(root, "biomes", id, "palette.json"))
    ? join(root, "biomes", id, "palette.json")
    : join(root, "palettes", `${id}-palette.json`);

if (!existsSync(palPath)) {
  console.log("FAIL file.decode no palette " + id);
  process.exit(1);
}

const pal = JSON.parse(readFileSync(palPath, "utf8"));
const kit =
  existsSync(join(root, "biomes", id, "films"))
    ? join(root, "biomes", id)
    : dirname(palPath).endsWith("palettes")
      ? join(root, "biomes", id)
      : dirname(palPath);

const ORDER = ["calm", "lean", "peak", "decay"];
const plates = ORDER.flatMap((tier) =>
  (pal.drawers?.[tier] || []).map((p) => ({ ...p, tier })),
);

function probe(file) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", file], { encoding: "utf8" });
  const err = (r.stderr || "") + (r.stdout || "");
  const durM = err.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const duration = durM
    ? Number(durM[1]) * 3600 + Number(durM[2]) * 60 + Number(durM[3])
    : 0;
  const v = err.match(/Video: ([a-z0-9_]+)[^\n]*?(\d{2,5})x(\d{2,5})/i);
  const pix = (err.match(/Video: [^\n]*?(yuv[0-9a-z]+)/i) || [])[1] || null;
  return {
    duration,
    codec: v ? v[1] : null,
    width: v ? Number(v[2]) : 0,
    height: v ? Number(v[3]) : 0,
    pix,
    audio: /Audio:/.test(err),
  };
}

function extract(file, ss, out) {
  const a = ["-v", "error"];
  if (ss > 0) a.push("-ss", ss.toFixed(3));
  a.push(
    "-i",
    file,
    "-frames:v",
    "1",
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280",
    "-y",
    out,
  );
  spawnSync("ffmpeg", a);
}

let fails = 0;
let coming = !!pal.coming;

for (const p of plates) {
  const file = join(kit, p.file);
  const sidecar = file.replace(/\.mp4$/i, ".cues.json");
  const required = p.required || p.tier === "decay";
  const tag = p.id;

  if (!existsSync(file)) {
    console.log("FAIL  " + tag + " file.decode missing");
    fails++;
    if (required) coming = true;
    continue;
  }

  const info = probe(file);
  if (!info.codec) {
    console.log("FAIL  " + tag + " file.decode no video");
    fails++;
    continue;
  }
  if (info.codec !== "h264") {
    console.log("FAIL  " + tag + " file.codec " + info.codec);
    fails++;
    continue;
  }
  if (info.pix && info.pix !== "yuv420p") {
    console.log("FAIL  " + tag + " file.pix_fmt " + info.pix);
    fails++;
    continue;
  }
  if (info.audio) {
    console.log("FAIL  " + tag + " file.audio autoplay dies");
    fails++;
    continue;
  }
  if (info.width !== 720 || info.height !== 1280) {
    console.log("FAIL  " + tag + " file.size " + info.width + "x" + info.height);
    fails++;
    continue;
  }
  if (info.duration < 6 || info.duration > 16) {
    console.log("FAIL  " + tag + " file.duration " + info.duration.toFixed(1) + "s");
    fails++;
    continue;
  }

  const cuesPath = existsSync(sidecar) ? sidecar : null;
  const sheet = cuesPath
    ? JSON.parse(readFileSync(cuesPath, "utf8"))
    : { plateId: p.id, duration: info.duration, cues: p.cues || [] };
  sheet.duration = info.duration;

  const v = spawnSync("node", [join(root, "scripts/validate-cues.mjs"), cuesPath || palPath], {
    encoding: "utf8",
  });
  if (cuesPath && v.status !== 0) {
    process.stdout.write(v.stdout || "");
    console.log("FAIL  " + tag + " cue.sheet");
    fails++;
    coming = true;
    continue;
  }

  const L = smokeL({
    duration: info.duration,
    cues: sheet.cues || [],
  });
  if (!L.ok) {
    console.log("FAIL  " + tag + " " + L.code + (L.L != null ? " L=" + L.L.toFixed(2) : ""));
    fails++;
    coming = true;
    continue;
  }
  if (L.code === "L.gray") {
    console.log("WARN  " + tag + " L.gray nudge window — do not spend cap-2");
  } else if (L.code === "L.na") {
    console.log("PASS  " + tag + " metal L.na");
  } else {
    console.log("PASS  " + tag + " " + L.code);
  }

  const smokeDir = join(kit, ".smoke", p.id);
  mkdirSync(smokeDir, { recursive: true });
  const d = info.duration;
  extract(file, 0, join(smokeDir, "first.jpg"));
  extract(file, d / 2, join(smokeDir, "mid.jpg"));
  extract(file, Math.max(0, d - 0.12), join(smokeDir, "last.jpg"));
  console.log("VISION  " + smokeDir + "/{first,mid,last}.jpg  identity C — back, ONE white GSD, no TAP");
}

if (fails) {
  console.log("FAIL biome " + id + " coming");
  process.exit(1);
}
if (coming) {
  console.log("PASS metal " + id + " — coming until L 3/3 + identity C");
  process.exit(0);
}
console.log("PASS biome " + id);
process.exit(0);
