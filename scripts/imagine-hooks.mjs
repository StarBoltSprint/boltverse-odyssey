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
  "ONE white German Shepherd, BACK to camera, lower third, locked-off camera.",
  "Gothic citadel hall, two tall oval energy portals: cyan-teal LEFT, gold-orange RIGHT.",
  "No text, no UI, no second dog, no face to camera, no third door, no dolly.",
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
  const vf =
    extname(dest) === ".mp4"
      ? "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280"
      : "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280";
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

export async function imagineStill({ root, slot, pose, dest, spawnPath }) {
  const lock = join(root, "lock");
  const example =
    pose === "atA" ? "example-at-a.jpg" : pose === "atB" ? "example-at-b.jpg" : "example-spawn.jpg";
  const refs = [imgRef(join(lock, "bolt-back.jpg")), imgRef(join(lock, example))];
  if ((pose === "atA" || pose === "atB") && spawnPath && existsSync(spawnPath)) {
    refs.push(imgRef(spawnPath));
  }
  const prompt = [
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

export async function imagineClip({ root, slot, kind, first, last, dest, seconds = 6 }) {
  const prompt = [
    LAW,
    catalogLines(root, slot),
    kind === "breath"
      ? "Micro breath only. Same pose. Locked-off. Loop. Do not walk. Do not turn."
      : "He walks two steps. Locked-off camera. ONE dog. Interpolate first to last. No tunnel. No clone.",
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
    body.last_frame = { url: dataUri(last) };
  }
  const j = await api("/videos/generations", body);
  let url = j.url || j.video?.url || j.data?.[0]?.url;
  const id = j.request_id || j.id;
  if (!url && id) url = await pollVideo(id);
  if (!url) throw new Error("no video url");
  const raw = dest + ".raw.mp4";
  await download(url, raw);
  encodePlate(raw, dest);
  return dest;
}
