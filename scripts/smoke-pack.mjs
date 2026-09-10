#!/usr/bin/env node
// smoke(file, kind, refs) → { ok, rule, at, note }
// usage:
//   node scripts/smoke-pack.mjs packs/<id>
//   node scripts/smoke-pack.mjs packs/<id>/films/walk-spawn-a.mp4 --kind walk
// Layers A+B here. Layer C = Grok + scripts/smoke-identity.md on .smoke/ frames.
// See SMOKE.md. Recook THIS plate, cap 2.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const SAME = 12;
const LOOP = 28;
const HW = 16;
const HH = 16;

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const flags = new Set(process.argv.filter((a) => a.startsWith("--")));
const kindFlag = (() => {
  const i = process.argv.indexOf("--kind");
  return i >= 0 ? process.argv[i + 1] : null;
})();

const target = args[0];
if (!target) {
  console.error("usage: node scripts/smoke-pack.mjs packs/<id> [| file --kind walk]");
  process.exit(2);
}

function ffmpegBuf(ffargs) {
  return execFileSync("ffmpeg", ["-v", "error", ...ffargs], {
    encoding: "buffer",
    maxBuffer: 720 * 1280 * 3 + 8192,
  });
}

function ffmpegErr(ffargs) {
  const r = spawnSync("ffmpeg", ["-hide_banner", ...ffargs], { encoding: "utf8" });
  return (r.stderr || "") + (r.stdout || "");
}

function probe(file) {
  const err = ffmpegErr(["-i", file]);
  const durM = err.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  const duration = durM
    ? Number(durM[1]) * 3600 + Number(durM[2]) * 60 + Number(durM[3])
    : 0;
  const v = err.match(/Video: ([a-z0-9_]+).*?([a-z0-9_]+).*?(\d{2,5})x(\d{2,5})/i);
  const v2 = err.match(/Video: ([a-z0-9_]+)[^\n]*?(\d{2,5})x(\d{2,5})/i);
  const codec = v ? v[1] : v2 ? v2[1] : null;
  const pix = (err.match(/Video: [^\n]*?(yuv[0-9a-z]+)/i) || [])[1] || null;
  const width = v ? Number(v[3]) : v2 ? Number(v2[2]) : 0;
  const height = v ? Number(v[4]) : v2 ? Number(v2[3]) : 0;
  const audio = /Audio:/.test(err);
  return { duration, codec, pix, width, height, audio, raw: err };
}

function rawFrame(file, ss, w, h) {
  const a = [];
  if (ss != null && ss > 0) a.push("-ss", ss.toFixed(3));
  a.push("-i", file, "-frames:v", "1", "-vf", `scale=${w}:${h}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1");
  const buf = ffmpegBuf(a);
  if (!buf || buf.length < w * h * 3) throw new Error("short frame");
  return buf.subarray(0, w * h * 3);
}

function writeJpg(file, ss, out) {
  const a = [];
  if (ss != null && ss > 0) a.push("-ss", ss.toFixed(3));
  a.push("-i", file, "-frames:v", "1", "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280", "-y", out);
  execFileSync("ffmpeg", ["-v", "error", ...a]);
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
  for (let y = y0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (vis[y * w + x] && !seen[y * w + x] && flood(x, y) >= minA) blobs++;
  return blobs;
}

function cloneScan(file, d) {
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

function inferKind(file) {
  const b = basename(file).toLowerCase();
  if (b.includes("enter")) return "enter";
  if (b.startsWith("walk")) return "walk";
  if (b.startsWith("breath")) return "breath";
  if (b.includes("at-a") || b.includes("ata")) return "still-atA";
  if (b.includes("at-b") || b.includes("atb")) return "still-atB";
  if (b.includes("spawn") && /\.jpe?g$/i.test(b)) return "still-spawn";
  if (/\.jpe?g$/i.test(b)) return "still-spawn";
  return "walk";
}

function expectDur(kind, file) {
  const b = basename(file).toLowerCase();
  if (kind === "enter") return [4, 8];
  if (kind === "breath") return b.includes("spawn") ? [4, 8] : [7, 13];
  if (kind === "walk") return [7, 13];
  return null;
}

function walkRefs(file, refs) {
  const b = basename(file).toLowerCase();
  if (b.includes("spawn-a")) return [refs.spawn, refs.atA];
  if (b.includes("spawn-b")) return [refs.spawn, refs.atB];
  if (b.includes("a-b") || b.includes("a_b")) return [refs.atA, refs.atB];
  if (b.includes("b-a") || b.includes("b_a")) return [refs.atB, refs.atA];
  return [refs.spawn, refs.atA];
}

function emit(row) {
  const tag = row.ok ? "PASS" : row.warn ? "WARN" : "FAIL";
  const extra = row.rule ? ` ${row.rule}` : "";
  const at = row.at ? ` @ ${row.at}` : "";
  const note = row.note ? ` (${row.note})` : "";
  const line = `${tag}  ${row.id}${extra}${at}${note}`;
  console.log(line);
  return row;
}

function smokeFile(file, kind, refs, required, smokeDir) {
  const id = basename(file);
  const row = (over) => emit({ id, kind, ok: true, required, ...over });
  const fail = (rule, at, note, warn = !required) =>
    emit({ id, kind, ok: false, warn, required, rule, at, note });

  if (!existsSync(file)) return fail("file.decode", "file", "missing");

  let info;
  try {
    info = probe(file);
  } catch (e) {
    return fail("file.decode", "file", e.message);
  }

  const still = kind.startsWith("still");
  if (!still) {
    if (!info.codec) return fail("file.decode", "file", "no video");
    if (info.codec && !String(info.codec).toLowerCase().includes("h264") && info.codec !== "h264") {
      if (info.codec !== "mjpeg") {
        /* jpeg probe can look like mjpeg; mp4 must be h264 */
        if (/\.mp4$/i.test(file) && info.codec !== "h264")
          return fail("file.codec", "file", info.codec);
      }
    }
    if (/\.mp4$/i.test(file) && info.codec && info.codec !== "h264")
      return fail("file.codec", "file", info.codec);
    if (info.pix && info.pix !== "yuv420p" && /\.mp4$/i.test(file))
      return fail("file.pix_fmt", "file", info.pix);
    if (info.audio) return fail("file.audio", "file", "autoplay dies");
    if (info.width && info.height && (info.width !== 720 || info.height !== 1280))
      return fail("file.size", "file", `${info.width}x${info.height}`);
    const band = expectDur(kind, file);
    if (band && info.duration && (info.duration < band[0] || info.duration > band[1]))
      return fail("file.duration", "file", `${info.duration.toFixed(1)}s`);
  } else if (info.width && info.height && (info.width !== 720 || info.height !== 1280)) {
    return fail("file.size", "still", `${info.width}x${info.height}`);
  }

  const d = info.duration || 0;
  const lastT = d > 0.2 ? d - 0.08 : 0;
  const midT = d > 0.4 ? d / 2 : 0;

  if (smokeDir) {
    try {
      mkdirSync(smokeDir, { recursive: true });
      if (still) {
        writeJpg(file, 0, join(smokeDir, "still.jpg"));
      } else {
        writeJpg(file, 0, join(smokeDir, "first.jpg"));
        writeJpg(file, midT, join(smokeDir, "mid.jpg"));
        writeJpg(file, lastT, join(smokeDir, "last.jpg"));
      }
    } catch {
      /* extract is best-effort for layer C */
    }
  }

  if (still) {
    if (existsSync(smokeDir)) {
      console.log(`VISION  ${smokeDir}/still.jpg  (layer C)`);
      if (needsC(kind, required))
        cJobs.push({
          id,
          kind,
          required: true,
          files: [join(smokeDir, "still.jpg")],
        });
    }
    return row();
  }

  try {
    const first = frameHash(file, 0);
    const last = frameHash(file, lastT);
    const hamFL = hamming(first, last);

    if (kind === "breath") {
      if (hamFL > LOOP) return fail("graph.first_eq_last", "t=last", `walked ham ${hamFL}`);
      const pose =
        /breath-a/i.test(file) ? refs.atA : /breath-b/i.test(file) ? refs.atB : refs.spawn;
      if (pose && existsSync(pose)) {
        const s = frameHash(pose, 0);
        if (hamming(first, s) > LOOP)
          return fail("graph.first_not_official", "t=0", "first ≠ pose still");
      }
    }

    if (kind === "walk" || kind === "enter") {
      if (hamFL < SAME) return fail("graph.first_eq_last", "t=last", `loop ham ${hamFL}`);
    }

    if (kind === "walk") {
      const [start, end] = walkRefs(file, refs);
      if (start && end && existsSync(start) && existsSync(end)) {
        const s = frameHash(start, 0);
        const e = frameHash(end, 0);
        if (hamming(first, s) > hamming(first, e) + 8)
          return fail("graph.first_not_official", "t=0", "first ≠ start still");
        if (hamming(last, e) > hamming(last, s) + 8)
          return fail("graph.last_not_official", "t=last", "last ≠ arrive still");
      }
    }

    if (kind === "enter" && refs.dest && existsSync(refs.dest)) {
      const dest = frameHash(refs.dest, 0);
      if (hamming(last, dest) < SAME)
        return fail("graph.last_is_dest_spawn", "t=last", "last = Hall' spawn");
    }

    const dogs = cloneScan(file, d);
    if (dogs >= 2) return fail("clone.two_dogs", "clip", `${dogs} dogs`);
  } catch (e) {
    return fail("file.decode", "frame", e.message);
  }

  if (existsSync(smokeDir)) {
    console.log(`VISION  ${smokeDir}/{first,mid,last}.jpg  (layer C)`);
    if (needsC(kind, required))
      cJobs.push({
        id,
        kind,
        required: true,
        files: [
          join(smokeDir, "first.jpg"),
          join(smokeDir, "mid.jpg"),
          join(smokeDir, "last.jpg"),
        ],
      });
  }
  return row();
}

function isPackDir(p) {
  return existsSync(join(p, "room.json")) || existsSync(join(p, "stills")) || existsSync(join(p, "films"));
}

function refsOf(pack) {
  return {
    spawn: join(pack, "stills/spawn.jpg"),
    atA: join(pack, "stills/at-a.jpg"),
    atB: join(pack, "stills/at-b.jpg"),
    dest: join(pack, "stills/a/spawn.jpg"),
  };
}

const jobsPack = [
  ["stills/spawn.jpg", "still-spawn", true],
  ["stills/at-a.jpg", "still-atA", true],
  ["stills/at-b.jpg", "still-atB", true],
  ["films/breath-spawn.mp4", "breath", true],
  ["films/breath-a.mp4", "breath", true],
  ["films/breath-b.mp4", "breath", true],
  ["films/walk-spawn-a.mp4", "walk", true],
  ["films/walk-spawn-b.mp4", "walk", true],
  ["films/walk-a-b.mp4", "walk", false],
  ["films/walk-b-a.mp4", "walk", false],
  ["films/enter-hall-a.mp4", "enter", false],
  ["films/enter-a-hall.mp4", "enter", false],
  ["films/enter/a-to-b.mp4", "enter", false],
  ["films/enter-a-b.mp4", "enter", false],
];

let fails = 0;
let warns = 0;
const cJobs = [];

function needsC(kind, required) {
  if (!required) return false;
  return kind.startsWith("still") || kind === "breath" || kind === "walk";
}

function run(file, kind, refs, required, packRoot) {
  const clip = basename(file, file.match(/\.[^.]+$/)?.[0] || "");
  const smokeDir = packRoot ? join(packRoot, ".smoke", clip) : join(dirname(file), ".smoke", clip);
  const r = smokeFile(file, kind, refs, required, smokeDir);
  if (!r.ok && r.required) fails++;
  else if (!r.ok) warns++;
}

if (isPackDir(target) && !kindFlag) {
  const refs = refsOf(target);
  for (const [rel, kind, required] of jobsPack) {
    const file = join(target, rel);
    if (!existsSync(file)) {
      if (required) {
        emit({ id: rel, kind, ok: false, required: true, rule: "file.decode", note: "missing" });
        fails++;
      }
      continue;
    }
    const dest =
      kind === "enter" && rel.includes("a-to-b")
        ? join(target, "stills/b/spawn.jpg")
        : kind === "enter" && rel.includes("a-hall")
          ? refs.spawn
          : refs.dest;
    run(file, kind, { ...refs, dest }, required, target);
  }
} else {
  const file = target;
  const pack = isPackDir(dirname(dirname(file))) ? dirname(dirname(file)) : dirname(file);
  const kind = kindFlag || inferKind(file);
  const required = !flags.has("--optional");
  run(file, kind, refsOf(pack), required, isPackDir(pack) ? pack : dirname(file));
}

if (fails) {
  console.log(`SMOKE FAIL  ${fails} required  recook that plate, cap 2`);
  process.exitCode = 1;
} else if (warns) {
  console.log(`SMOKE PASS  (${warns} optional WARN — recook or drop)`);
} else {
  console.log("SMOKE PASS");
}

const packRoot = isPackDir(target) ? target : null;
if (cJobs.length && packRoot) {
  const man = join(packRoot, ".smoke/MANIFEST.json");
  mkdirSync(join(packRoot, ".smoke"), { recursive: true });
  writeFileSync(man, JSON.stringify({ prompt: "scripts/smoke-identity.md", jobs: cJobs }, null, 2));
  console.log(`LAYER C REQUIRED  ${cJobs.length} plates (stills + walks + breaths)`);
  console.log(`  1. Read scripts/smoke-identity.md`);
  console.log(`  2. Open each image in ${man}`);
  console.log(`  3. One line per id: PASS  or  FAIL identity.face @ t=last`);
  console.log(`  4. FAIL → recook THIS plate, cap 2. Do not Hang.`);
  for (const j of cJobs) console.log(`  C  ${j.id}  ${j.files.join(" ")}`);
} else {
  console.log("LAYER C  stills/walks/breaths only — read scripts/smoke-identity.md");
}
if (fails) process.exit(1);
