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
  "Gothic citadel hall, two tall oval OR RECT energy portals (oval preferred-ok, never wood, never chrome UI rectangles): cyan-teal LEFT, gold-orange RIGHT. Jambs + sill + gap + depth. Stable energy fill.",
  "No text, no UI, no second dog, no face to camera, no 3/4, no sit, no lie, no third door, no dolly.",
].join(" ");

export const HALL_LAW = LAW;

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
      "Micro breath. Feet glued. Seamless loop. Locked-off.",
    ].join(" ");
  }
  if (pose === "atB") {
    return [
      "ONE dog only. He is ALREADY at the gold RIGHT sill.",
      "NEVER a dog at center. NEVER a dog at teal. NEVER a second Bolt.",
      "Do not complete the hall toward spawn. Do not walk. Do not turn.",
      "Micro breath. Feet glued. Seamless loop. Locked-off.",
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

function exampleName(pose) {
  return pose === "atA" ? "example-at-a.jpg" : pose === "atB" ? "example-at-b.jpg" : "example-spawn.jpg";
}

function officialSillRel(pose) {
  return pose === "atA" ? "lock/sill-at-a.jpg" : "lock/sill-at-b.jpg";
}

function mossSillRel(pose) {
  return pose === "atA" ? "packs/moss/stills/at-a.jpg" : "packs/moss/stills/at-b.jpg";
}

/** at-A lecture — PLACE+POSE from the lock example; taille is FORCED (live ember FAIL×2 was 0.19/0.16+sit). */
export const ATA_LOCK_COPY =
  "copy PLACE+POSE from example; FORCE taille 0.35–0.40; FORCE STANDING; never shrink to 0.18; hall materials from spawn/catalog only — ignore example décor.";

export const ATA_FORCE_TAILLE =
  "FORCE taille 0.35–0.40 (aim 0.36). NEVER shrink to 0.18. NEVER 0.16. NEVER 0.19. Live ember at-A FAIL×2 was sill-band 0.19+sit+face and 0.16+sit. Teacher is PLACE+POSE only — do NOT copy a tiny teacher scale.";

export const ATA_FORCE_STANDING =
  "FORCE STANDING when using the teacher: four paws on the stone, legs LONG, haunches UP. NEVER sit. NEVER loaf. NEVER face. NEVER muzzle. A sitting tiny dog is FAIL even if place is left.";

/**
 * Side ref for at-A / at-B.
 * at-A prefers lock/example-at-a.jpg (SmiR lock teacher: standing BACK toward teal L, gold visible).
 * Do not prefer hung moss for at-A — moss décor leaks into ember/dusk/etc.
 * at-B still prefers hung moss PASS, then lock/example-at-b / lock/sill-at-b.
 * Tiny archives are example-at-*-tiny.jpg — never send.
 */
export function sillTeacherRel(root, pose) {
  if (pose !== "atA" && pose !== "atB") return join("lock", exampleName(pose));
  const moss = mossSillRel(pose);
  const official = officialSillRel(pose);
  const swapped = join("lock", exampleName(pose));
  if (pose === "atA") {
    if (root && existsSync(join(root, swapped))) return swapped;
    if (root && existsSync(join(root, official))) return official;
    if (root && existsSync(join(root, moss))) return moss;
    return swapped;
  }
  if (root && existsSync(join(root, moss))) return moss;
  if (root && existsSync(join(root, official))) return official;
  if (root && existsSync(join(root, swapped))) return swapped;
  return swapped;
}

/** bolt-back is 0.53 close-up. Unlabeled edit of the close-up = punch-sill. Enlarge never sends the teacher (shrink). */
export function stillRefOrder(pose, hasSpawn, root, opts) {
  const enlarge = opts === true || (opts && opts.enlarge);
  if (enlarge && (pose === "atA" || pose === "atB")) {
    return hasSpawn ? ["fail", "bolt-back.jpg", "spawn"] : ["fail", "bolt-back.jpg"];
  }
  if (pose === "atA" || pose === "atB") {
    const side = sillTeacherRel(root, pose);
    return hasSpawn ? ["spawn", "bolt-back.jpg", side] : [side, "bolt-back.jpg"];
  }
  return hasSpawn ? ["bolt-back.jpg", exampleName(pose), "spawn"] : ["bolt-back.jpg", exampleName(pose)];
}

/** Second sill cook: FAIL jpg is the image. ONLY grow the dog. Same camera/hall. No teacher. */
export const ENLARGE_SILL_COPY =
  "ENLARGE ONLY. Same camera, same hall, same energy rifts (oval or RECT). The first image IS this FAIL plate — he is already AT this sill. ONLY enlarge the dog toward bboxH/H 0.35–0.40 (aim 0.36) STANDING. Do not re-compose. Do not recrop. Do not zoom the hall. Do not move him to center. Do not copy a tiny teacher scale. NEVER shrink to 0.16 / 0.18 / 0.19 / 0.21.";

export function enlargeStillLine(side) {
  const here = side === "A" ? "teal LEFT" : "gold RIGHT";
  return [
    ENLARGE_SILL_COPY,
    "He stays AT the " + here + " sill (paws on that lip). STANDING four paws, BACK, crown to camera, legs LONG, haunches UP.",
    "NEVER sit. NEVER loaf. NEVER face. NEVER 3/4. NEVER mid-hall. NEVER punch-sill.",
    "Live ember at-A FAIL×2 was sill-band 0.19+sit+face and 0.16+sit (after #4: 0.19/0.21 and at-B 0.20/0.21+sit). This edit GROWS that FAIL. It does not start over from the teacher.",
    "IGNORE bolt-back crop (~0.53). IGNORE example-at-*-tiny. Hall materials stay as they are. Oval or RECT energy OK (never wood, never chrome UI).",
    ATA_FORCE_TAILLE,
    ATA_FORCE_STANDING,
  ].join(" ");
}

export function sillStillLine(side) {
  const here = side === "A" ? "teal LEFT" : "gold RIGHT";
  const other = side === "A" ? "Gold energy rift still visible on the right" : "Teal energy rift still visible on the left";
  const fill = side === "A" ? "teal" : "gold";
  const walk = side === "A" ? "left" : "right";
  const third = side === "A" ? "LEFT third" : "RIGHT third";
  return [
    "He is already AT the sill/threshold (seuil), NOT mid-hall, NOT spawn center.",
    "He is ALREADY at the " + here + " energy rift THRESHOLD (oval or RECT) — paws ON that sill lip, body in the " + third + " of the plate.",
    "NEVER mid-hall. NEVER spawn. NEVER center. NEVER the fork. NEVER a grown spawn dog standing between the two rifts.",
    "Spawn = center + both doors + fork. This plate is the " + here + " sill only. Huge empty stone on the other side.",
    "BACK to camera, TWO ears on TOP of the skull, crown to camera, muzzle HIDDEN.",
    "STANDING four paws on the STONE FLOOR in FRONT of that sill. Legs LONG, haunches UP. Same lock as the spawn still — only he moved " + walk + " to the door. Do not grow him in place.",
    "Feet stay on the hall floor. NEVER inside the rift. NEVER on the jamb. NEVER climbing the " + fill + " fill. The portal DWARFS him.",
    "Ear tips / crown stay in the LOWER HALF of the plate (dog top ≥ 0.50 of frame H). punch-sill FAIL if the head enters the rift (top < 0.46).",
    "NEVER sit. NEVER a loaf. NEVER haunches down. NEVER lie. NEVER 3/4. NEVER cheek. NEVER face. NEVER muzzle.",
    "NEVER punch-in. NEVER fill the " + fill + ". NEVER copy bolt-back close-up scale (~0.53 is illegal).",
    ATA_FORCE_TAILLE,
    ATA_FORCE_STANDING,
    "IGNORE a tiny ~0.18 crop the same way you IGNORE bolt-back ~0.53 — both scales are illegal. NEVER copy example-at-*-tiny.",
    "He is NOT seated facing the " + fill + ". He is NOT looking at the rift. " + other + ". Same camera — no dolly.",
    "Growing from spawn ~0.26 to sill 0.36 is required. Growing in place at center is illegal — MOVE him to the sill AND set taille 0.35–0.40. Do not shrink him to the teacher.",
    "Δh/H from spawn MUST be under 0.12. Size in band is not enough if he is still mid-hall / spawn-cx, sits, turns, shows a face, or climbs the rift. Same lens as spawn.",
  ].join(" ");
}

export function stillRefLine(pose, hasSpawn, teacherRel) {
  if (pose !== "atA" && pose !== "atB") return "";
  const teacher = teacherRel || (pose === "atA" ? join("lock", exampleName(pose)) : officialSillRel(pose));
  const side = pose === "atA" ? "LEFT teal" : "RIGHT gold";
  const energy =
    "Oval or RECT energy portals are both OK (oval preferred-ok). Copy jambs + sill + energy fill. NEVER wood. NEVER chrome UI rectangles. Do not FAIL oval shape.";
  if (hasSpawn) {
    if (pose === "atA") {
      return [
        "First image = the spawn still: hall materials from spawn/catalog only. SAME camera, SAME light, SAME energy rifts (oval or RECT). ONLY the dog MOVES to the " +
          side +
          " sill (paws on that lip, body in that third). Do not leave him at center spawn. Do not grow him in place. Do not shrink him to the teacher. Do not zoom. Do not recrop.",
        "Second image = bolt-back.jpg: coat / back / collar IDENTITY only. IGNORE its close-up crop (bbox ~0.53 is illegal).",
        "Third image = " +
          teacher +
          ": official SEUIL teacher (SmiR lock/example-at-a — standing BACK toward teal L, gold visible). " +
          ATA_LOCK_COPY +
          " " +
          ATA_FORCE_TAILLE +
          " " +
          ATA_FORCE_STANDING +
          " Dog already AT the " +
          side +
          " sill (seuil), standing BACK, feet on the stone floor.",
        "IGNORE example décor (vines / star-dome / moss paint). IGNORE a tiny ~0.18 crop the same way you IGNORE bolt-back ~0.53 — both scales are illegal. NEVER copy lock/example-at-*-tiny (sit + ~0.18).",
        energy,
      ].join(" ");
    }
    return [
      "First image = the spawn still: SAME hall, SAME camera, SAME light, SAME energy rifts (oval or RECT). Hall materials from spawn/catalog only — ignore example décor. ONLY the dog MOVES to the " +
        side +
        " sill (paws on that lip, body in that third). Do not leave him at center spawn. Do not grow him in place. Do not zoom. Do not recrop.",
      "Second image = bolt-back.jpg: coat / back / collar IDENTITY only. IGNORE its close-up crop (bbox ~0.53 is illegal).",
      "Third image = " +
        teacher +
        ": official SEUIL teacher (hung moss PASS / swapped lock/example-at-*). Copy PLACE and POSE — dog already AT the " +
        side +
        " sill (seuil), standing BACK, feet on the stone floor. " +
        ATA_FORCE_TAILLE +
        " " +
        ATA_FORCE_STANDING,
      "IGNORE a tiny ~0.18 crop the same way you IGNORE bolt-back ~0.53 — both scales are illegal. NEVER copy lock/example-at-*-tiny (sit + ~0.18; live FAIL sill-band 0.19–0.21).",
      energy,
    ].join(" ");
  }
  if (pose === "atA") {
    return [
      "First image = " +
        teacher +
        ": official SEUIL teacher (SmiR lock/example-at-a). " +
        ATA_LOCK_COPY +
        " " +
        ATA_FORCE_TAILLE +
        " " +
        ATA_FORCE_STANDING +
        " (" +
        side +
        " sill, standing BACK, not mid-hall). IGNORE a tiny ~0.18 crop the same way you IGNORE bolt-back ~0.53.",
      "Second image = bolt-back.jpg: coat / back / collar only. IGNORE close-up crop (~0.53).",
      energy,
    ].join(" ");
  }
  return [
    "First image = " +
      teacher +
      ": official SEUIL teacher. Copy PLACE and POSE (" +
      side +
      " sill, standing BACK, not mid-hall). " +
      ATA_FORCE_TAILLE +
      " " +
      ATA_FORCE_STANDING +
      " Hall materials from spawn/catalog only — ignore example décor. IGNORE a tiny ~0.18 crop the same way you IGNORE bolt-back ~0.53.",
    "Second image = bolt-back.jpg: coat / back / collar only. IGNORE close-up crop (~0.53).",
    energy,
  ].join(" ");
}

export function spawnStillLine() {
  return [
    "Bolt center, lower third, BACK to camera, TWO ears, STANDING four paws, weight on the floor.",
    "NEVER sit. NEVER lie. NEVER 3/4. NEVER face. NEVER muzzle.",
    "BOTH oval OR RECT energy portals fully visible: cyan-teal LEFT, gold-orange RIGHT. Jambs + sill + depth. Oval preferred-ok. Never wood. Never chrome UI rectangles.",
    "A luminous teal-gold fork on the floor from his paws to BOTH sills (path 5–15% of frame H, glow in the stone, not chrome UI).",
    "He is SMALL in the hall — dog bbox height 0.24–0.28 of the frame (band 0.22–0.32). Same scale as the layout reference.",
    "The two rifts DWARF him. NOT a close-up. NOT filling the plate. Locked-off camera.",
  ].join(" ");
}

export function walkClipLine() {
  return [
    "10 seconds. ONE dog only. He LEAVES spawn in the first second. Continuous even walk on FOUR STANDING PAWS.",
    "NEVER sit. NEVER lie. NEVER face. NEVER 3/4. NEVER a second Bolt at center or the other door.",
    "Energy portals stay oval or RECT (never wood, never chrome UI). Do not morph into a blob.",
    "Never freeze mid-hall. Arrives ~8s, then HOLDS STANDING 1–2s at the sill, still back to camera.",
    "No leftover empty time. No linger-then-warp. No sudden sprint. Do not walk back to spawn.",
    "Do not invent a floor ice disc. Locked-off. ONE full-white GSD. Last frame is the arrive still. No tunnel.",
  ].join(" ");
}

function hallStillPrompt(slotLines, pose, hasSpawn, teacherRel) {
  return [
    LAW,
    slotLines,
    stillRefLine(pose, hasSpawn, teacherRel),
    pose === "spawn" ? spawnStillLine() : "",
    pose === "atA" ? sillStillLine("A") : "",
    pose === "atB" ? sillStillLine("B") : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function imagineStill({ root, slot, pose, dest, spawnPath, lane, enlargeFrom }) {
  const lock = join(root, "lock");
  const hasSpawn = Boolean(spawnPath && existsSync(spawnPath));
  const bolt = join(lock, "bolt-back.jpg");
  const teacherRel = pose === "atA" || pose === "atB" ? sillTeacherRel(root, pose) : join("lock", exampleName(pose));
  const teacher = join(root, teacherRel);
  const failSrc = enlargeFrom && existsSync(enlargeFrom) ? enlargeFrom : null;
  const enlarge = Boolean(failSrc && (pose === "atA" || pose === "atB"));
  const refs = [];
  if (lane) {
    refs.push(imgRef(bolt));
    if (hasSpawn) refs.push(imgRef(spawnPath));
  } else if (enlarge) {
    refs.push(imgRef(failSrc));
    if (existsSync(bolt)) refs.push(imgRef(bolt));
    if (hasSpawn) refs.push(imgRef(spawnPath));
  } else if ((pose === "atA" || pose === "atB") && hasSpawn) {
    refs.push(imgRef(spawnPath), imgRef(bolt), imgRef(teacher));
  } else {
    refs.push(imgRef(bolt));
    refs.push(imgRef(existsSync(teacher) ? teacher : join(lock, exampleName(pose))));
    if (hasSpawn) refs.push(imgRef(spawnPath));
  }
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
    : enlarge
      ? [
          LAW,
          catalogLines(root, slot),
          enlargeStillLine(pose === "atA" ? "A" : "B"),
          "First image = the FAIL jpg: enlarge ONLY. Same camera / hall. Do not send / copy the teacher.",
          hasSpawn ? "Spawn still = hall materials lock only. Do not move him back to center spawn." : "",
          "Second image (if present) = bolt-back.jpg: coat / back / collar IDENTITY only. IGNORE its close-up crop (bbox ~0.53 is illegal).",
        ]
          .filter(Boolean)
          .join(" ")
      : hallStillPrompt(catalogLines(root, slot), pose, hasSpawn, teacherRel);
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
          : walkClipLine(),
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
