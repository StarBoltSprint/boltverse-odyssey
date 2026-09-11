#!/usr/bin/env node
// smoke(file, kind, refs) → { ok, rule, at, note }
// usage:
//   node scripts/smoke-pack.mjs packs/<id>
//   node scripts/smoke-pack.mjs packs/<id>/films/walk-spawn-a.mp4 --kind walk
// Layers A+B here. Layer C = Grok + scripts/smoke-identity.md on .smoke/ frames.
// See SMOKE.md. Recook THIS plate, cap 2.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { matchPose, GW, GH, creamHeight, creamPlace, PUNCH } from "./still-pair.mjs";
import { pHash, dHash, hamming } from "./phash.mjs";

const TH = JSON.parse(
  readFileSync(new URL("../smoke.json", import.meta.url), "utf8"),
);
const SAME = TH.pHash.same;
const GRAY = TH.pHash.gray;
const FAILH = TH.pHash.fail;
const LAST_OFF = TH.lastOffsetSec;
const DH_DRIFT = TH.dHash.breath_drift;
const PH = 32;

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
  const vf = `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,scale=${w}:${h}`;
  a.push("-i", file, "-frames:v", "1", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1");
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

function frameP(file, ss) {
  return pHash(rawFrame(file, ss, PH, PH), PH);
}

function frameD(file, ss) {
  return dHash(rawFrame(file, ss, 9, 8), 9, 8);
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

function cloneScan(file, d, kind) {
  const times = [0, 0.3, 0.8, 1.5];
  const step = d > 8 ? 1.0 : 0.6;
  for (let t = 0; t < d; t += step) times.push(t);
  if (kind === "walk" || kind === "enter" || kind === "breath") {
    for (const t of [Math.max(0, d - 2), Math.max(0, d - 1), Math.max(0, d - 0.15)]) {
      times.push(t);
    }
  }
  let max = 0;
  for (const t of times) {
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

function walkPlantScan(file, d) {
  // Frozen mid-hall (not spawn) — linger hash misses this. Frost try1: 2–5s planted, then warp.
  try {
    const a = creamPlace(rawFrame(file, 2.0, GW, GH), GW, GH);
    const b = creamPlace(rawFrame(file, Math.min(4.6, d * 0.58), GW, GH), GW, GH);
    if (dogOk(a) && dogOk(b) && Math.abs(b.cx - a.cx) < 0.05) return 4.5;
  } catch {
    /* skip */
  }
  return null;
}

function walkLingerScan(file, d, firstHash) {
  // Still parked at spawn at ~3s → later last_frame must yank. Same sin as dash.
  const t1 = Math.min(3.4, d * 0.42);
  for (let t = 2.2; t <= t1; t += 0.5) {
    try {
      if (hamming(frameP(file, t), firstHash) <= SAME) return t;
    } catch {
      /* skip */
    }
  }
  return null;
}

function dogOk(p) {
  // Ice / vapor: creamPlace snaps to a floor blob or returns empty.
  // Lost dog must NOT become cx=0.50 at hall center.
  return p && p.h >= 0.16 && p.h <= 0.48 && (p.w == null || p.w < 0.5);
}

function walkSprintScan(file, d) {
  let prev = null;
  for (let t = 0; t < d - 0.3; t += 0.7) {
    try {
      const p = creamPlace(rawFrame(file, t, GW, GH), GW, GH);
      if (!dogOk(p)) {
        prev = null; // drop track — frost vapor, same family as breath Δh
        continue;
      }
      if (prev) {
        const dt = t - prev.t;
        const v = Math.abs(p.cx - prev.cx) / dt;
        // Consecutive samples only. A gap after lost-dog is not a warp.
        if (dt >= 0.4 && dt <= 1.05 && v > 0.35) return { t, v };
      }
      prev = { ...p, t };
    } catch {
      prev = null;
    }
  }
  return null;
}

function walkReturnScan(file, d, firstHash) {
  // 6s walk: arrive ~2s. t=0.4d (2.4s) is still the outbound step — not a return.
  // Scan only after he should already be at the door.
  const t0 = Math.max(3.2, d * 0.58);
  const t1 = d * 0.92;
  if (t0 >= t1) return null;
  for (let t = t0; t < t1; t += 0.5) {
    try {
      if (hamming(frameP(file, t), firstHash) <= SAME) return t;
    } catch {
      /* skip */
    }
  }
  return null;
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
  if (kind === "walk") return [8, 12];
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
  const lastT = d > LAST_OFF * 2 ? d - LAST_OFF : 0;
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
    try {
      const fa = rawFrame(file, 0, GW, GH);
      const hh = creamHeight(fa, GW, GH);
      if (hh >= PUNCH) return fail("gate.size", "still", `punch-in ${hh.toFixed(2)}`);
      if (kind === "still-spawn" && (hh < 0.18 || hh > 0.36))
        return fail("gate.size", "still", `spawn-band ${hh.toFixed(2)}`);
      if ((kind === "still-atA" || kind === "still-atB") && (hh < 0.28 || hh > 0.48))
        return fail("gate.size", "still", `sill-band ${hh.toFixed(2)} want 0.35-0.40 (FAIL >0.48 ice)`);
    } catch (e) {
      return fail("file.decode", "still", e.message);
    }
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
    const first = frameP(file, 0);
    const last = frameP(file, lastT);
    const hamFL = hamming(first, last);

    if (kind === "breath") {
      if (hamFL >= FAILH) return fail("graph.breath_drift", "t=last", `pHash ham ${hamFL}`);
      if (hamFL > SAME) {
        const dh = hamming(frameD(file, 0), frameD(file, lastT));
        if (dh >= DH_DRIFT)
          return fail("graph.breath_drift", "t=last", `dHash ${dh} (paws/cam slid)`);
        emit({
          id,
          kind,
          ok: false,
          warn: true,
          required: false,
          rule: "graph.breath_gray",
          note: `pHash ham ${hamFL}`,
        });
        warns++;
      }
      const pose =
        /breath-a/i.test(file) ? refs.atA : /breath-b/i.test(file) ? refs.atB : refs.spawn;
      if (pose && existsSync(pose)) {
        const s = frameP(pose, 0);
        const hs = hamming(first, s);
        if (hs >= FAILH)
          return fail("graph.first_not_official", "t=0", `first ≠ pose still ham ${hs}`);
      }
    }

    if (kind === "walk" || kind === "enter") {
      if (hamFL <= SAME) return fail("graph.first_eq_last", "t=last", `loop pHash ham ${hamFL}`);
    }

    if (kind === "walk") {
      const back = walkReturnScan(file, d, first);
      if (back != null)
        return fail(
          "graph.walk_return",
          `t=${back.toFixed(1)}`,
          "mid-clip frame ≈ spawn — one trip only, no teleport home",
        );
      const linger = walkLingerScan(file, d, first);
      if (linger != null)
        return fail(
          "graph.walk_linger",
          `t=${linger.toFixed(1)}`,
          "still at spawn ~3s — he must leave in the first second, or last_frame will warp",
        );
      const plant = walkPlantScan(file, d);
      if (plant != null)
        return fail(
          "graph.walk_plant",
          `t=${plant.toFixed(1)}`,
          "frozen mid-hall — last_frame will warp; even gait from t=0",
        );
      const dash = walkSprintScan(file, d);
      if (dash)
        return fail(
          "graph.walk_sprint",
          `t=${dash.t.toFixed(1)}`,
          `dash ${dash.v.toFixed(2)} W/s — even pace, no last-second warp to the door`,
        );
    }

    if (kind === "walk") {
      const [start, end] = walkRefs(file, refs);
      if (start && end && existsSync(start) && existsSync(end)) {
        const s = frameP(start, 0);
        const e = frameP(end, 0);
        const hs = hamming(first, s);
        const he = hamming(last, e);
        if (hs >= FAILH)
          return fail("graph.first_not_official", "t=0", `first ≠ start still ham ${hs}`);
        if (he >= FAILH)
          return fail("graph.last_not_official", "t=last", `last ≠ arrive still ham ${he}`);
        if (he > SAME && he < FAILH)
          emit({
            id,
            kind,
            ok: false,
            warn: true,
            required: false,
            rule: "graph.last_gray",
            note: `pHash ham ${he}`,
          }),
            (warns++);
      }
    }

    if (kind === "enter" && refs.dest && existsSync(refs.dest)) {
      const dest = frameP(refs.dest, 0);
      if (hamming(last, dest) <= SAME)
        return fail("graph.enter_reveals_hall", "t=last", "last = Hall' spawn");
    }

    const dogs = cloneScan(file, d, kind);
    if (dogs >= 2)
      return fail(
        "clone.two_dogs",
        kind === "walk" ? "t=last" : "clip",
        `${dogs} dogs — walk last 2s must be ONE body`,
      );

    try {
      const fa = rawFrame(file, 0, GW, GH);
      const fb = rawFrame(file, lastT, GW, GH);
      const edge =
        kind === "enter"
          ? "enter"
          : kind === "walk"
            ? basename(file).replace(/\.mp4$/i, "")
            : "breath";
      const g = matchPose(fa, fb, edge, { w: GW, h: GH });
      if (!g.ok) return fail(g.why[0].split(" ")[0], "pair", g.why.join("; "));

      if (kind === "breath") {
        const doorStill = /breath-a/i.test(file) ? refs.atA : /breath-b/i.test(file) ? refs.atB : null;
        if (doorStill && refs.spawn && existsSync(doorStill) && existsSync(refs.spawn)) {
          const p0 = creamPlace(fa, GW, GH);
          const ps = creamPlace(rawFrame(refs.spawn, 0, GW, GH), GW, GH);
          const pd = creamPlace(rawFrame(doorStill, 0, GW, GH), GW, GH);
          if (dogOk(p0) && dogOk(ps) && dogOk(pd)) {
            const toSpawn = Math.abs(p0.cx - ps.cx);
            const toDoor = Math.abs(p0.cx - pd.cx);
            if (toSpawn + 0.06 < toDoor)
              return fail(
                "graph.breath_is_spawn",
                "t=0",
                "breath-A/B first frame is spawn — dest after walk must be the door still, or the splice clones",
              );
          }
        }
        const pose =
          /breath-a/i.test(file) ? refs.atA : /breath-b/i.test(file) ? refs.atB : refs.spawn;
        if (pose && existsSync(pose)) {
          const ps = rawFrame(pose, 0, GW, GH);
          const gp = matchPose(fa, ps, "breath", { w: GW, h: GH });
          if (!gp.ok) return fail(gp.why[0].split(" ")[0], "t=0", gp.why.join("; "));
        }
      }
      if (kind === "walk") {
        const [start, end] = walkRefs(file, refs);
        if (start && existsSync(start)) {
          const gs = matchPose(fa, rawFrame(start, 0, GW, GH), edge, { w: GW, h: GH, warnHall: true });
          if (!gs.ok) return fail(gs.why[0].split(" ")[0], "t=0", gs.why.join("; "));
          if (gs.warn?.length) {
            emit({ id, kind, ok: false, warn: true, required: false, rule: "gate.rig", note: gs.warn.join("; ") });
            warns++;
          }
        }
        if (end && existsSync(end)) {
          const ge = matchPose(fb, rawFrame(end, 0, GW, GH), edge, { w: GW, h: GH, warnHall: true });
          if (!ge.ok) return fail(ge.why[0].split(" ")[0], "t=last", ge.why.join("; "));
          if (ge.warn?.length) {
            emit({ id, kind, ok: false, warn: true, required: false, rule: "gate.rig", note: ge.warn.join("; ") });
            warns++;
          }
        }
      }
    } catch {
      /* still-pair is extra; A+B hashes already ran */
    }
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
  for (const [label, a, b, edge] of [
    ["stills spawn→at-a", refs.spawn, refs.atA, "walk-spawn-A"],
    ["stills spawn→at-b", refs.spawn, refs.atB, "walk-spawn-B"],
  ]) {
    if (!existsSync(a) || !existsSync(b)) continue;
    try {
      const g = matchPose(rawFrame(a, 0, GW, GH), rawFrame(b, 0, GW, GH), edge, { w: GW, h: GH });
      if (!g.ok) {
        emit({ id: label, kind: "still-pair", ok: false, required: true, rule: g.why[0].split(" ")[0], note: g.why.join("; ") });
        fails++;
      } else {
        emit({ id: label, kind: "still-pair", ok: true, required: true });
        if (g.warn?.length) {
          emit({ id: label, kind: "still-pair", ok: false, warn: true, required: false, rule: "gate.size", note: g.warn.join("; ") });
          warns++;
        }
      }
    } catch (e) {
      emit({ id: label, kind: "still-pair", ok: false, required: true, rule: "file.decode", note: e.message });
      fails++;
    }
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
if (packRoot) {
  writeFileSync(
    join(packRoot, "smoke.json"),
    JSON.stringify(
      {
        ok: fails === 0,
        script: "scripts/smoke-pack.mjs",
        fails,
        warns,
      },
      null,
      2,
    ) + "\n",
  );
  if (fails)
    console.log("HANG BLOCKED  smoke.json ok=false — player must not mount this pack");
  else console.log("HANG OK  smoke.json written by the script (not by Grok)");
}
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
