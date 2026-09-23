#!/usr/bin/env node
// Constellation KEEP — Odyssey Law 0 (read-only): Imagine films = image + last_frame.
// ALWAYS pass first frame AND last frame. Copied API plumbing only. Does not touch boltverse-odyssey.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, unlinkSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const BASE = process.env.IMAGINE_BASE || "https://api.x.ai/v1";
const IMAGE_MODEL = process.env.IMAGINE_IMAGE_MODEL || "grok-imagine-image-2.0";
const VIDEO_MODEL = process.env.IMAGINE_VIDEO_MODEL || "grok-imagine-video-1.5";

/** Law 0 — every film, every time. Camera never moves. One body. No morph. */
const LAW = [
  "Photoreal square 1:1 plate, black void, ONE celestial body centered.",
  "CAMERA IS A LOCKED TRIPOD bolted to the floor. It never pans, never tilts, never zooms, never dollies, never pushes in, never pulls out, never flys over the surface, never changes focal length.",
  "The FULL disc is always visible. Black void remains around the limb in every frame. NEVER a close-up. NEVER terrain filling the frame. NEVER a surface flyover.",
  "Apparent diameter of the body is IDENTICAL in every frame — same pixel radius, same silhouette scale, same distance, same framing.",
  "ONE body only. NEVER a second globe. NEVER a nested planet. NEVER a moon. NEVER a bulge that becomes a ball sitting on the surface.",
  "NO morph. NO melting. NO new continents. NO text. NO UI.",
  "ONLY a SLOW rotation of the SAME body on its own vertical axis. Low yaw. Not a fast spin.",
  "Silent plate.",
].join(" ");

export const PLANET_LAW = LAW;

const WORLDS = {
  tide: {
    kind: "spin",
    paint:
      "Blue ocean world with a thin bright ring. ONE globe filling MOST of the plate — the limb stays close to the edge, about 90 percent of the width. The globe rotates slowly on its vertical axis inside the ring. The ring stays in the same plane and does not tumble. Water stays water. Clouds drift with the rotation only. Never a second globe. Full disc in frame, black void only in the corners. Locked tripod. Same size the whole time. NEVER zoom. NEVER change diameter.",
  },
  canyon: {
    kind: "spin",
    paint:
      "Rust-red scarred desert globe. ONE globe only. The same canyons and highlands stay canyons — they travel around the sphere as surface texture. They NEVER round into a second sphere. NEVER become a moon. NEVER nest a smaller planet on the surface. Full disc always in frame with black void around the limb. Locked tripod: no zoom, no dolly, no push-in, no pull-out. Same pixel radius the whole time.",
  },
  crystal: {
    kind: "spin",
    paint:
      "Icy terrestrial globe. Frozen white continents, dark oceans, thin cyan atmosphere on the limb. ONE globe filling most of the plate — the limb stays close to the edge. The same ice sheets travel around the sphere as surface texture. Full disc always in frame. Locked tripod: no zoom, no dolly. Same pixel radius the whole time. Never a second globe.",
  },
  hollow: {
    kind: "spin",
    paint:
      "Dark grey cratered moon. ONE globe. The same craters rotate slowly into view. No new impact features. No atmosphere bloom. Never a second globe. Full disc in frame. Locked tripod. Same size the whole time.",
  },
  drift: {
    kind: "spin",
    paint:
      "Ash-grey dusty globe. ONE globe. The same pale surface rotates slowly. Fine dust may catch light. No morph. No new oceans. Never a second globe. Full disc in frame. Locked tripod. Same size the whole time.",
  },
  core: {
    kind: "breath",
    paint:
      "PERFECTLY ROUND spherical white-hot star core — a glowing ORB, a pulsar, NOT a human heart, NOT an anatomical organ, NOT ventricles, NOT aorta. Huge circular blinding white nucleus already filling the center. Dense branching white lightning plasma tendrils radiate 360 degrees from the ROUND orb toward the edges. Tendrils WAVE and flicker, they NEVER retract. The round nucleus PULSES — never a frozen photo. Same pixel radius first to last. NO morph. NO zoom. Locked tripod. No planets. No second body. No anatomy. Black void only in the far corners.",
  },
};

function key() {
  const k = process.env.XAI_API_KEY;
  if (!k) {
    throw new Error(
      "CLI_RAIL_SKIP: XAI_API_KEY is unset, so this Node call does not reach api.x.ai. " +
        "Continue in the SuperGrok session: Imagine Video with both stills pinned (first + last). " +
        "Missing key is not a cook FAIL. BAN one-still I2V and “forcé localement”.",
    );
  }
  return k;
}

function mime(p) {
  const e = extname(p).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".mp4") return "video/mp4";
  return "image/jpeg";
}

function dataUri(path) {
  const b = readFileSync(path).toString("base64");
  return `data:${mime(path)};base64,${b}`;
}

async function api(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) throw new Error("Imagine " + res.status + " " + path + " " + text.slice(0, 280));
  return json;
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("download " + r.status);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

function ffmpeg(args) {
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "ffmpeg failed").slice(0, 400));
}

function encodeStill(src, dest) {
  ffmpeg(["-y", "-i", src, "-vf", "scale=720:720:force_original_aspect_ratio=increase,crop=720:720", dest]);
}

function encodeClip(src, dest) {
  ffmpeg([
    "-y",
    "-i",
    src,
    "-vf",
    "scale=720:720:force_original_aspect_ratio=increase,crop=720:720",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-an",
    "-movflags",
    "+faststart",
    dest,
  ]);
}

async function pollVideo(id) {
  for (let i = 0; i < 60; i++) {
    const res = await fetch(BASE + "/videos/" + id, {
      headers: { Authorization: "Bearer " + key() },
    });
    const j = await res.json();
    const st = j.status || j.state;
    const url = j.video?.url || j.url || j.data?.[0]?.url;
    if (url && (st === "done" || st === "completed" || !st)) return url;
    if (st === "failed" || st === "expired") throw new Error("video " + st);
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("video poll timeout");
}

function spinLine(paint) {
  return [
    "First frame and last frame are already pinned by the API — do not redraw them.",
    "The two stills are the SAME body at the SAME size. Interpolate ONLY a slow axial yaw between them.",
    "CAMERA LOCKED ON A TRIPOD. Framing never changes. No zoom. No dolly. No push-in. No pull-out. No flyover. No focal-length change.",
    "The full disc stays in frame. Black void around the limb in every frame. Never a close-up of the surface.",
    "Low yaw. A gentle turn. Not a fast spin. Not a morph.",
    "NO morph. NO change of size. NO silhouette scale change. Same pixel radius the whole time.",
    "ONE body only. NEVER a second globe. NEVER a nested planet. NEVER a moon. Canyons stay canyons — they do not round into another world.",
    "Features that exist only travel around the sphere. Nothing new appears. Nothing melts.",
    "Same center. Black void stays black.",
    paint,
    "NO morph. NO size change. NO camera move. ONE body only. Never a second globe. Camera never moves.",
  ].join(" ");
}

function breathLine(paint) {
  return [
    "First frame and last frame are the SAME energy core at the SAME size, different lightning pose (already pinned).",
    "The HEART is ALIVE — white-hot nucleus pulses, inner fire crawls, never a still photograph.",
    "Branching lightning tendrils WAVE and flicker around the entire core in EVERY frame. They NEVER disappear. They NEVER retract into a smooth round ball.",
    "NO change of size. Same pixel radius the whole time. Same center. Never small then large.",
    "Camera lock-off. No zoom. No dolly. No push-in. No pull-out.",
    paint,
    "ONE body only. Round white electric orb. Lightning stays. Size never changes. NOT an orange sun. NOT a human heart.",
  ].join(" ");
}

export async function imagineLastStill({ first, dest, paint }) {
  const prompt = [
    LAW,
    "Edit: rotate the SAME body a SMALL amount (~15 degrees) around the vertical axis.",
    "Last pose of a SLOW spin. Keep the FULL globe in frame.",
    "IDENTICAL size and pixel radius as the first still. Same distance. Same framing. Same focal length.",
    "Do NOT zoom in. Do NOT zoom out. Do NOT pull the camera back. Do NOT crop into the surface. Do NOT fill the frame with terrain.",
    "The limb and the black void around it must remain visible, same as the first still.",
    "ONE globe only. No second body. No nested planet. No moon.",
    "NO morph. NO change of size. Do not invent a new planet. Do not change the silhouette scale.",
    paint,
  ].join(" ");
  const body = {
    model: IMAGE_MODEL,
    prompt,
    image: { url: dataUri(first) },
    aspect_ratio: "1:1",
  };
  const j = await api("/images/edits", body);
  const url = j.url || j.data?.[0]?.url;
  if (!url) throw new Error("no still url");
  const raw = dest + ".raw.jpg";
  await download(url, raw);
  encodeStill(raw, dest);
  return dest;
}

export async function imaginePlanetClip({ first, last, dest, kind, paint, seconds }) {
  if (!first) throw new Error("clip needs first frame");
  if (!last) throw new Error("Law 0: last_frame is required — always pass first AND last");
  if (kind === "spin" && last === first) {
    throw new Error("spin last_frame must be distinct from first (a low-yaw pose of the SAME body)");
  }
  const prompt = [LAW, kind === "breath" ? breathLine(paint) : spinLine(paint)].join(" ");
  const dur = seconds ?? (kind === "breath" ? 6 : 10);
  const body = {
    model: VIDEO_MODEL,
    prompt,
    duration: dur,
    aspect_ratio: "1:1",
    resolution: "720p",
    image: { url: dataUri(first) },
    last_frame: { url: dataUri(last) },
  };
  const j = await api("/videos/generations", body);
  let url = j.url || j.video?.url || j.data?.[0]?.url;
  const vid = j.request_id || j.id;
  if (!url && vid) url = await pollVideo(vid);
  if (!url) throw new Error("no video url");
  const raw = dest + ".raw.mp4";
  await download(url, raw);
  encodeClip(raw, dest);
  return dest;
}

function posterFromClip(clip, dest) {
  ffmpeg(["-y", "-i", clip, "-ss", "0.12", "-frames:v", "1", dest]);
}

function pingPong(src, dest) {
  ffmpeg([
    "-y",
    "-i",
    src,
    "-filter_complex",
    "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1:a=0,fps=24,format=yuv420p[v]",
    "-map",
    "[v]",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    dest,
  ]);
}

function encodeH264(src, dest) {
  ffmpeg([
    "-y",
    "-i",
    src,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "20",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    dest,
  ]);
}

/** RIFE 4× — keep fps, insert optical-flow frames (a turn, not freeze-frames). */
function rifeSlow(src, dest, multi = 4) {
  const script = join(process.cwd(), "scripts/rife_slow.py");
  const rifeRoot = process.env.RIFE_ROOT || "/tmp/Practical-RIFE";
  const model = join(rifeRoot, "train_log/flownet.pkl");
  if (!existsSync(script) || !existsSync(model)) {
    throw new Error("RIFE not installed (need scripts/rife_slow.py + " + model + ")");
  }
  const raw = dest.replace(/\.mp4$/, "-rife-raw.mp4");
  const r = spawnSync(
    "python3",
    [script, "--video", src, "--output", raw, "--multi", String(multi), "--fps", "24"],
    { encoding: "utf8", env: { ...process.env, RIFE_ROOT: rifeRoot } },
  );
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "rife failed").slice(0, 600));
  }
  encodeH264(raw, dest);
}

/** Lock disc radius + center so Imagine dolly cannot leak into the loop. */
function lockGlobe(src, dest, extra = []) {
  const script = join(process.cwd(), "scripts/lock_globe.py");
  const r = spawnSync("python3", [script, "--video", src, "--output", dest, ...extra], {
    encoding: "utf8",
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "lock globe failed").slice(0, 600));
  }
}

/** Make last still the same apparent diameter as first before Imagine video. */
function matchDisc(src, ref, dest) {
  const script = join(process.cwd(), "scripts/lock_globe.py");
  const r = spawnSync(
    "python3",
    [script, "--still", src, "--match-to", ref, "--output", dest],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "match disc failed").slice(0, 600));
  }
}

function discRadius(path) {
  const r = spawnSync("python3", [join(process.cwd(), "scripts/lock_globe.py"), "--disc", path], {
    encoding: "utf8",
  });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "disc failed").slice(0, 300));
  return parseFloat(r.stdout.trim().split(/\s+/)[0]);
}

function clipSpread(path) {
  const r = spawnSync(
    "python3",
    [join(process.cwd(), "scripts/lock_globe.py"), "--measure", "--video", path, "--output", "-"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || "measure failed").slice(0, 300));
  const line = r.stdout.trim().split("\n").pop() || "";
  const m = line.match(/min ([0-9.]+)\s+max ([0-9.]+)\s+median ([0-9.]+)/);
  if (!m) return 1;
  const min = parseFloat(m[1]);
  const max = parseFloat(m[2]);
  const med = parseFloat(m[3]) || 1;
  return (max - min) / med;
}

function lastDiscOk(firstPath, lastPath) {
  const r0 = discRadius(firstPath);
  const r1 = discRadius(lastPath);
  const rel = Math.abs(r1 - r0) / r0;
  const ok = rel < 0.08 && r1 > 0.22 && r1 < 0.46;
  console.log(`disc first=${r0.toFixed(3)} last=${r1.toFixed(3)} rel=${rel.toFixed(3)} ${ok ? "ok" : "REJECT"}`);
  return ok;
}

export async function cookWorld(id, videosDir, { force = false } = {}) {
  const spec = WORLDS[id];
  if (!spec) throw new Error("unknown world " + id);
  const first = join(videosDir, id + ".jpg");
  if (!existsSync(first)) throw new Error("missing first still " + first);
  const kitchen = join(videosDir, "_spin");
  mkdirSync(kitchen, { recursive: true });
  const last = join(kitchen, id + "-last.jpg");
  const dest = join(kitchen, id + ".mp4");
  if (spec.kind === "spin") {
    if (force && existsSync(last)) unlinkSync(last);
    if (!existsSync(last)) {
      console.log("still last", id);
      await imagineLastStill({ first, dest: last, paint: spec.paint });
    }
    const lastMatched = join(kitchen, id + "-last-matched.jpg");
    for (let attempt = 0; attempt < 2; attempt++) {
      if (lastDiscOk(first, last)) break;
      console.log("last still rejected — regenerate", id, "attempt", attempt + 1);
      await imagineLastStill({ first, dest: last, paint: spec.paint });
    }
    console.log("match last disc to first", id);
    matchDisc(last, first, lastMatched);
    for (let attempt = 0; attempt < 2; attempt++) {
      console.log("clip spin (first+last, camera lock, no morph, no size change, one body)", id, "try", attempt + 1);
      await imaginePlanetClip({
        first,
        last: lastMatched,
        dest,
        kind: "spin",
        paint: spec.paint,
        seconds: 10,
      });
      const spread = clipSpread(dest);
      console.log("clip radius spread", spread.toFixed(3), id);
      if (spread < 0.12) break;
      console.log("clip zoomed — recook", id);
    }
    const locked = join(kitchen, id + "-locked.mp4");
    const rife = join(kitchen, id + "-rife.mp4");
    const ping = join(kitchen, id + "-slow-ping.mp4");
    console.log("lock globe size", id);
    lockGlobe(dest, locked);
    console.log("RIFE 4x slow-mo", id);
    rifeSlow(locked, rife, 4);
    console.log("ping-pong", id);
    pingPong(rife, ping);
    return ping;
  }
  console.log("clip breath (first+last, heart boils, filaments wave, camera lock, no size change)", id);
  if (force && existsSync(last)) unlinkSync(last);
  if (!existsSync(last)) {
    console.log("still last (evolved granulation / slight yaw)", id);
    await imagineLastStill({
      first,
      dest: last,
      paint:
        spec.paint +
        " Edit: the SAME star, identical size and framing. Photosphere granulation has boiled forward — fire cells have crawled to new positions, like a slow axial yaw of ~18 degrees. Filaments in a new wave pose. Do not zoom. Do not change diameter.",
    });
  }
  const lastMatched = join(kitchen, id + "-last-matched.jpg");
  matchDisc(last, first, lastMatched);
  const locked = join(kitchen, id + "-locked.mp4");
  const ping = join(kitchen, id + "-slow-ping.mp4");
  for (let attempt = 0; attempt < 2; attempt++) {
    await imaginePlanetClip({
      first,
      last: lastMatched,
      dest,
      kind: "breath",
      paint: spec.paint,
      seconds: 10,
    });
    const spread = clipSpread(dest);
    console.log("clip radius spread", spread.toFixed(3), id);
    if (spread < 0.12) break;
    console.log("clip zoomed — recook", id);
  }
  console.log("lock photosphere, keep corona", id);
  lockGlobe(dest, locked, ["--star"]);
  console.log("ping-pong", id);
  pingPong(locked, ping);
  return ping;
}

const force = process.argv.includes("--force");
const ids = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const isCli = process.argv[1] && process.argv[1].includes("imagine-planet-hooks");
if (isCli) {
  const videosDir = join(process.cwd(), "public/videos");
  const queue = ids.length ? ids : Object.keys(WORLDS);
  for (const id of queue) {
    const out = await cookWorld(id, videosDir, { force });
    const live = join(videosDir, id + ".mp4");
    const bak = join(videosDir, "_spin", id + ".prev.mp4");
    if (existsSync(live)) copyFileSync(live, bak);
    copyFileSync(out, live);
    // Keep the Law 0 first still. Never replace it with a video frame
    // (a mid-clip close-up would poison the next cook).
    if (!existsSync(join(videosDir, id + ".jpg"))) {
      posterFromClip(live, join(videosDir, id + ".jpg"));
    }
    console.log("hung", id, live);
  }
}
