#!/usr/bin/env node
// Mid pin for Imagine Video. Not Imagine Agent.
// first = image. last = last_frame. mid = keyframes (the exact picture).
// image_urls is not a pin. This file calls api.x.ai only when XAI_API_KEY is set.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, extname } from "node:path";

const BASE = process.env.IMAGINE_BASE || "https://api.x.ai/v1";
const VIDEO_MODEL = process.env.IMAGINE_VIDEO_MODEL || "grok-imagine-video-1.5";

function key() {
  const k = process.env.XAI_API_KEY;
  if (!k) {
    throw new Error(
      "CLI_RAIL_SKIP: XAI_API_KEY is unset. Pin first, mid and last in the session Imagine Video. Missing key is not a cook FAIL.",
    );
  }
  return k;
}

function mime(p) {
  const e = extname(p).toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  return "image/jpeg";
}

function dataUri(path) {
  return `data:${mime(path)};base64,${readFileSync(path).toString("base64")}`;
}

/** Snap onto the 1/3 s grid. Strictly inside (0, duration). */
export function snapKeyframeTime(at, seconds) {
  const grid = 1 / 3;
  const t = Math.round(at / grid) * grid;
  const lo = grid;
  const hi = Math.max(lo, seconds - grid);
  return Math.min(hi, Math.max(lo, Math.round(t * 1000) / 1000));
}

/**
 * Mid pins for grok-imagine-video-1.5. These are keyframes, not image_urls.
 * Up to 4. At least 1/3 s apart. timestamp_s is inside (0, duration).
 *
 * mid:
 *   "side.jpg"                    half the clip
 *   ["a.jpg", "b.jpg"]            spread evenly, ends excluded
 *   [{ path: "a.jpg", at: 2 }]    that second
 */
export function midKeyframes(mid, seconds) {
  if (!mid) return [];
  if (!(seconds > 2 / 3)) throw new Error("keyframes need duration > 2/3 s");
  const list = Array.isArray(mid) ? mid : [mid];
  if (!list.length) return [];
  if (list.length > 4) throw new Error("keyframes max 4");
  const slots = list.map((item, i) => {
    if (typeof item === "string") {
      const at = list.length === 1 ? seconds / 2 : (seconds * (i + 1)) / (list.length + 1);
      return { path: item, at };
    }
    if (!item || !item.path) throw new Error("mid keyframe needs a path");
    if (!(item.at > 0)) throw new Error("mid keyframe needs at in seconds");
    return { path: item.path, at: item.at };
  });
  const used = [];
  return slots.map((slot) => {
    if (!existsSync(slot.path)) throw new Error("mid keyframe missing " + slot.path);
    let at = snapKeyframeTime(slot.at, seconds);
    for (let n = 0; n < 12 && used.some((u) => Math.abs(u - at) < 1 / 3 - 1e-6); n += 1) {
      at = snapKeyframeTime(at + 1 / 3, seconds);
    }
    if (used.some((u) => Math.abs(u - at) < 1 / 3 - 1e-6)) {
      throw new Error("keyframes must be at least 1/3 s apart");
    }
    used.push(at);
    return { image: { url: dataUri(slot.path) }, timestamp_s: at };
  });
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

/**
 * First + mid + last on grok-imagine-video-1.5.
 * image pins the start. keyframes pins the middle. last_frame pins the end.
 * One mid path lands at half the clip. midAt sets that second.
 */
export async function imagineMidClip({
  first,
  mid,
  last,
  dest,
  seconds = 6,
  prompt = "",
  aspect_ratio = "2:3",
  resolution = "720p",
  midAt,
}) {
  if (!first || !mid || !last) throw new Error("mid clip needs first, mid keyframe, and last_frame");
  if (!existsSync(first) || !existsSync(last)) throw new Error("mid clip still missing");
  const pins = midAt != null && typeof mid === "string" ? [{ path: mid, at: midAt }] : mid;
  const frames = midKeyframes(pins, seconds);
  if (!frames.length) throw new Error("mid clip needs a keyframe");
  const body = {
    model: VIDEO_MODEL,
    prompt,
    duration: seconds,
    aspect_ratio,
    resolution,
    image: { url: dataUri(first) },
    last_frame: { url: dataUri(last) },
    keyframes: frames,
  };
  const j = await api("/videos/generations", body);
  let url = j.url || j.video?.url || j.data?.[0]?.url;
  const vid = j.request_id || j.id;
  if (!url && vid) url = await pollVideo(vid);
  if (!url) throw new Error("no video url");
  mkdirSync(dirname(dest), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error("download " + r.status);
  writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
  return dest;
}
