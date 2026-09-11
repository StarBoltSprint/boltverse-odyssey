#!/usr/bin/env node
// xAI Imagine API. Not the Grok chat. Needs XAI_API_KEY.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { spawnSync } from "node:child_process";

const BASE = process.env.IMAGINE_BASE || "https://api.x.ai/v1";
const IMAGE_MODEL = process.env.IMAGINE_IMAGE_MODEL || "grok-imagine-image-2.0";
const VIDEO_MODEL = process.env.IMAGINE_VIDEO_MODEL || "grok-imagine-video-1.5";

const LAW = [
  "Photoreal still or clip, vertical 9:16, 720x1280.",
  "ONE FULL-white German Shepherd, ZERO black on the dog (no saddle, no mask, no black ears), teal collar, BACK to camera, locked-off camera.",
  "Gothic citadel hall, two tall oval energy portals: cyan-teal LEFT, gold-orange RIGHT.",
  "No text, no UI, no second dog, no face to camera, no third door, no dolly.",
].join(" ");

const LANE_LAW = [
  "Photoreal still or clip, vertical 9:16, 720x1280.",
  "ONE FULL-white German Shepherd, ZERO black on the dog, teal collar, BACK to camera, two ears visible, locked-off camera.",
  "Crystal-ice forest path. NO citadel. NO portals. NO HUD. NO text. NO second dog. NO face. NO dolly.",
].join(" ");

function key() {
  const k = process.env.XAI_API_KEY;
  if (!k) throw new Error("XAI_API_KEY missing — use --dry-run");
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

function imgRef(path) {
  return { url: dataUri(path), type: "image_url" };
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
  if (!res.ok) throw new Error("Imagine " + res.status + " " + path + " " + text.slice(0, 200));
  return json;
}

async function download(url, dest) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("download " + r.status);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
}

function encodePlate(src, dest) {
  const vf = "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
  const args =
    extname(dest) === ".mp4"
      ? ["-y", "-i", src, "-vf", vf, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", dest]
      : ["-y", "-i", src, "-vf", vf, dest];
  const r = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg plate failed");
}

async function pollVideo(id) {
  for (let i = 0; i < 48; i++) {
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

function catalogLines(root, slot) {
  const p = join(root, "catalog", slot + ".md");
  if (!existsSync(p)) return slot;
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .slice(0, 4)
    .join(" ");
}

function breathLine(pose) {
  if (pose === "atA") {
    return [
      "ONE dog only. He is ALREADY at the teal LEFT sill.",
      "NEVER a dog at center. NEVER a dog at gold. NEVER a second Bolt.",
      "Do not complete the hall toward spawn. Do not walk. Do not turn.",
      "Micro breath. Feet glued. 6 seconds. Loop. Locked-off.",
    ].join(" ");
  }
  if (pose === "atB") {
    return [
      "ONE dog only. He is ALREADY at the gold RIGHT sill.",
      "NEVER a dog at center. NEVER a dog at teal. NEVER a second Bolt.",
      "Do not complete the hall toward spawn. Do not walk. Do not turn.",
      "Micro breath. Feet glued. 6 seconds. Loop. Locked-off.",
    ].join(" ");
  }
  return [
    "ONE dog only. He is ALREADY at center spawn.",
    "NEVER a second dog at either door. NEVER a ghost at a sill.",
    "Do not walk to a portal. Micro breath. Feet glued. 6 seconds. Loop. Locked-off.",
  ].join(" ");
}

function laneClipLine(pose, kind) {
  const p = String(pose || "");
  if (kind === "breath" || p === "pose") {
    return [
      LANE_LAW,
      "ONE dog. He STANDS on four paws, micro breath, feet glued.",
      "NEVER sit. NEVER howl. NEVER jump. NEVER profile. NEVER a second dog. Loop. Locked-off.",
    ].join(" ");
  }
  const side = /L/i.test(p) ? "LEFT" : /R/i.test(p) ? "RIGHT" : "fork";
  const act = p.startsWith("lean")
    ? "ONE act: the ice FORKS. He TAKES the " +
      side +
      " vein and STAYS. cx moves and HOLDS. Glow on that vein. NEVER wobble back to center. NEVER keep running straight down the middle."
    : p === "fork"
      ? "ONE act: he CUTS from one vein to the other. Still back. Glow on the chosen vein."
      : "Gallop forward on the ice. Standing or running four paws. NEVER sit. NEVER howl.";
  return [
    LANE_LAW,
    "He GALLOPS the whole clip. NEVER sits. NEVER howls. NEVER jumps. NEVER profile. NEVER a second dog.",
    act,
    "Last frame is last_frame. World advanced: crystals he passed are gone.",
  ].join(" ");
}

function isLanePose(pose) {
  const p = String(pose || "");
  return p.startsWith("lean") || p === "fork";
}

export async function imagineStill({ root, slot, pose, dest, spawnPath, lane }) {
  const lock = join(root, "lock");
  const example =
    pose === "atA" ? "example-at-a.jpg" : pose === "atB" ? "example-at-b.jpg" : "example-spawn.jpg";
  const refs = [imgRef(join(lock, "bolt-back.jpg"))];
  if (!lane) refs.push(imgRef(join(lock, example)));
  if (spawnPath && existsSync(spawnPath)) refs.push(imgRef(spawnPath));
  const prompt = lane
    ? [
        LANE_LAW,
        catalogLines(root, slot),
        spawnPath
          ? "Same forest as the reference still. World ADVANCED — crystals already passed are gone. Same dog, same lock. He is on the path at the destination station."
          : "Bolt on the center ice path, lower third, both sides of the forest readable.",
      ]
        .filter(Boolean)
        .join(" ")
    : [
        LAW,
        catalogLines(root, slot),
        pose === "spawn" ? "Bolt center, both portals readable." : "",
        pose === "atA" ? "Bolt at the teal LEFT portal. Gold still visible on the right." : "",
        pose === "atB" ? "Bolt at the gold RIGHT portal. Teal still visible on the left." : "",
      ]
        .filter(Boolean)
        .join(" ");
  const body = {
    model: IMAGE_MODEL,
    prompt,
    image: refs[0],
    image_urls: refs.slice(1),
    aspect_ratio: "9:16",
  };
  const j = await api("/images/edits", body);
  const url = j.url || j.data?.[0]?.url;
  if (!url) throw new Error("no still url");
  const raw = dest + ".raw";
  await download(url, raw);
  encodePlate(raw, dest);
  return dest;
}

export async function imagineClip({ root, slot, kind, first, last, dest, seconds = 6, pose, lane }) {
  const prompt = lane || isLanePose(pose)
    ? laneClipLine(pose, kind)
    : [
        LAW,
        catalogLines(root, slot),
        kind === "breath"
          ? breathLine(pose)
          : "10 seconds. He LEAVES spawn in the first second. Continuous even walk. Never freeze mid-hall. Walks the whole clip. Arrives ~8s, then HOLDS 1–2s. No leftover empty time. No linger-then-warp. No sudden sprint, no last-second warp. Do not walk back to spawn. Do not invent a floor ice disc. Locked-off. ONE full-white GSD. Last frame is the arrive still. No tunnel.",
      ].join(" ");
  const body = {
    model: VIDEO_MODEL,
    prompt,
    duration: seconds,
    aspect_ratio: "9:16",
    resolution: "720p",
    image: { url: dataUri(first) },
  };
  if (kind === "walk") {
    if (!last) throw new Error("walk needs last_frame");
    if (last === first) throw new Error("walk last_frame must be distinct");
    body.last_frame = { url: dataUri(last) };
  }
  if (kind === "breath") {
    const hold = last || first;
    body.last_frame = { url: dataUri(hold) };
  }
  const j = await api("/videos/generations", body);
  let url = j.url || j.video?.url || j.data?.[0]?.url;
  const vid = j.request_id || j.id;
  if (!url && vid) url = await pollVideo(vid);
  if (!url) throw new Error("no video url");
  const raw = dest + ".raw.mp4";
  await download(url, raw);
  encodePlate(raw, dest);
  return dest;
}
