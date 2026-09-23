/**
 * GPU openable objects — law 38.
 *
 * Doors, chests, generators, crystal hatches. Imagine cooks three keyed
 * states (closed / open / transition) plus an optional content bib.
 * This module never paints an open door into densify.
 *
 * GPU owns the hit zone, the open/close anim, the Lena LOD band, and
 * the content spawn. Placement is howlPose. Not raytracing.
 *
 *   import { openableState, openableFrame, openableHit, openableOpen, assertOpenableNative } from "./gpuOpenable.js";
 *
 * Copy into Live next to howlLive.js. Draw `object.bib` on pose.dest.
 * While `content` is set, draw that bib as another keyed quad.
 * A generator `lightCue` is a set-row for lightLayerFrame — the beam stays a light layer.
 */
import { howlPose } from "../howl-live/howlLive.js";
import { objectBand } from "../lena-lod/lenaLod.js";

export const OPENABLE = {
  /** Seconds for progress to travel the full 0→1 (or 1→0). */
  animSec: 0.45,
};

export const KINDS = ["door", "chest", "generator", "hatch"];
export const BIB_STATES = ["closed", "open", "transition"];

export const RAIL = {
  densify: "A",
  zones: "B",
  tileDensify: false,
  coversPlate: false,
};

export const GPU = {
  required: true,
  composite: "over-densify",
  bakeIntoDensify: false,
  raytrace: false,
  layers: ["bolt", "lena", "howl", "path-beat", "light", "openable"],
};

export const NATIVE = {
  geometry: "densify-lanes",
  cone: "howlPose",
  lanes: 3,
  gpu: true,
  composite: GPU.composite,
  bakeIntoDensify: false,
  gradeFromPlate: true,
  hud: false,
  clock: "densify",
  tileDensify: false,
  raytrace: false,
  paintedOpen: false,
};

function slugNoun(noun) {
  const raw = String(noun || "prop");
  if (/[./\\]/.test(raw)) throw new Error("openable bib noun");
  const s = raw
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!s) throw new Error("openable bib noun");
  return s;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/** 'L' | 'C' | 'R' | -1 | 0 | 1 → cone index. Unknown → null. */
export function normalizeLane(lane) {
  if (lane === "L" || lane === "l" || lane === -1) return -1;
  if (lane === "C" || lane === "c" || lane === "M" || lane === "m" || lane === 0) return 0;
  if (lane === "R" || lane === "r" || lane === 1) return 1;
  return null;
}

/** closed | open | transition. opening and closing both read the transition bib. */
export function bibStateOf(phase) {
  if (phase === "open") return "open";
  if (phase === "closed") return "closed";
  return "transition";
}

/** Hung Imagine state. Keyed. Not a crop of densify. */
export function openableBib(kind, noun, state) {
  if (!KINDS.includes(kind)) throw new Error("openable kind");
  if (!BIB_STATES.includes(state) && state !== "content") throw new Error("openable state");
  return `biome/fx/openable/${kind}/${slugNoun(noun)}-${state}.mp4`;
}

/** Optional loot / interior. Another keyed plate. Not painted into Video A. */
export function contentBib(kind, noun) {
  return openableBib(kind, noun, "content");
}

function hitRect(dest) {
  const px = dest.w * 0.08;
  const py = dest.h * 0.08;
  return { x: dest.x - px, y: dest.y - py, w: dest.w + px * 2, h: dest.h + py * 2 };
}

function inside(rect, x, y) {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

function normalizeObject(raw) {
  if (!raw || raw.id == null || raw.id === "") throw new Error("openable id");
  const kind = String(raw.kind || "chest");
  if (!KINDS.includes(kind)) throw new Error("openable kind");
  const lane = normalizeLane(raw.lane != null ? raw.lane : 0);
  if (lane === null) throw new Error("openable lane");
  const z = Number.isFinite(Number(raw.z)) ? Number(raw.z) : 0.2;
  const want = raw.want === "open" || raw.phase === "open" ? "open" : "closed";
  let progress = raw.progress != null ? clamp01(raw.progress) : want === "open" ? 1 : 0;
  let phase = raw.phase;
  if (phase !== "closed" && phase !== "opening" && phase !== "open" && phase !== "closing") {
    if (progress >= 1) phase = "open";
    else if (progress <= 0) phase = "closed";
    else phase = want === "open" ? "opening" : "closing";
  }
  if (phase === "open") progress = 1;
  if (phase === "closed") progress = 0;
  return {
    id: String(raw.id),
    kind,
    noun: slugNoun(raw.noun || kind),
    lane,
    z,
    want: phase === "open" && raw.want !== "closed" ? "open" : want,
    phase,
    progress,
    content: raw.content ? slugNoun(raw.content) : null,
    lightId: raw.lightId ? String(raw.lightId) : null,
  };
}

/** Planted props. They start closed unless `want` or `phase` is open. */
export function openableState(objects = []) {
  return {
    objects: (objects || []).map((raw) => normalizeObject(raw)),
    clock: 0,
  };
}

function withWant(state, id, want) {
  let found = false;
  const objects = (state.objects || []).map((obj) => {
    if (obj.id !== String(id)) return obj;
    found = true;
    return { ...obj, want };
  });
  if (!found) throw new Error("openable id");
  return { ...state, objects };
}

/** Ask the prop to open. The anim runs on the next openableFrame ticks. */
export function openableOpen(state, id) {
  return withWant(state, id, "open");
}

/** Ask the prop to close. */
export function openableClose(state, id) {
  return withWant(state, id, "closed");
}

function stepProgress(obj, dt, animSec) {
  let progress = obj.progress;
  let phase = obj.phase;
  const room = !(animSec > 0) ? 1 : Math.max(0, Number(dt) || 0) / animSec;
  if (obj.want === "open" && progress < 1) {
    progress = Math.min(1, progress + room);
    phase = progress >= 1 - 1e-9 ? "open" : "opening";
    if (phase === "open") progress = 1;
  } else if (obj.want === "closed" && progress > 0) {
    progress = Math.max(0, progress - room);
    phase = progress <= 1e-9 ? "closed" : "closing";
    if (phase === "closed") progress = 0;
  } else if (progress >= 1) {
    phase = "open";
    progress = 1;
  } else {
    phase = "closed";
    progress = 0;
  }
  return { ...obj, progress, phase };
}

function decorate(obj, ctx, animSec) {
  const cw = ctx.cw || 768;
  const ch = ctx.ch || 1168;
  const pawY = ctx.pawY != null ? ctx.pawY : ch * 0.84;
  const destH0 = ctx.destH0 || 200;
  const pose = howlPose(obj.lane, obj.z, cw, ch, destH0, pawY);
  const band = objectBand(pose.t);
  const sky = ctx.zone === "sky";
  const stateName = bibStateOf(obj.phase);
  const hittable = band !== "far";
  const open = obj.phase === "open";
  const content =
    open && obj.content
      ? {
          noun: obj.content,
          bib: contentBib(obj.kind, obj.content),
          visible: band !== "far",
          gpu: true,
          composite: GPU.composite,
          bakeIntoDensify: false,
          gradeFromPlate: true,
          hud: false,
        }
      : null;
  const lightCue = obj.lightId
    ? { id: obj.lightId, on: obj.progress > 0, intensity: obj.progress }
    : null;
  return {
    id: obj.id,
    kind: obj.kind,
    noun: obj.noun,
    lane: obj.lane,
    z: obj.z,
    want: obj.want,
    phase: obj.phase,
    progress: obj.progress,
    bibState: stateName,
    bib: openableBib(obj.kind, obj.noun, stateName),
    pose,
    band,
    hit: hitRect(pose.dest),
    hittable,
    key: sky ? "black" : "green",
    contact: !sky && band === "near",
    content,
    lightCue,
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    gradeFromPlate: true,
    hud: false,
    inWorld: true,
    cone: "howlPose",
    paintedOpen: false,
    animSec,
    tileDensify: false,
  };
}

/**
 * Topmost hittable prop under the point, or null.
 * Far-band props are visible and not hittable (Lena LOD).
 */
export function openableHit(frame, x, y) {
  const hits = (frame && frame.objects ? frame.objects : [])
    .filter((obj) => obj.hittable && obj.hit && inside(obj.hit, x, y))
    .sort((a, b) => b.pose.t - a.pose.t);
  return hits.length ? hits[0].id : null;
}

function applyAct(objects, act) {
  if (!act) return objects;
  const wantOf = new Map();
  for (const row of act) {
    if (!row || row.id == null) continue;
    wantOf.set(String(row.id), row.open === false || row.want === "closed" ? "closed" : "open");
  }
  return objects.map((obj) => (wantOf.has(obj.id) ? { ...obj, want: wantOf.get(obj.id) } : obj));
}

/**
 * One Live tick.
 * ctx: { now, cw, ch, pawY, destH0, zone, animSec, act, set }
 * `act` is [{ id, open: true|false }] applied before the anim step.
 * `set` is [{ id, z, lane }] when densify scroll moves the plant.
 * Pass plate time as `now`. z stays put until `set` says otherwise.
 */
export function openableFrame(state, dt, ctx = {}) {
  const step = Math.max(0, Number(dt) || 0);
  const now = ctx.now != null && ctx.now !== "" ? Number(ctx.now) : (Number(state.clock) || 0) + step;
  const animSec = ctx.animSec != null ? Number(ctx.animSec) : OPENABLE.animSec;
  let objects = applyAct(state.objects || [], ctx.act);
  if (ctx.set) {
    const move = new Map();
    for (const row of ctx.set) {
      if (row && row.id != null) move.set(String(row.id), row);
    }
    objects = objects.map((obj) => {
      const row = move.get(obj.id);
      if (!row) return obj;
      const lane = row.lane != null ? normalizeLane(row.lane) : obj.lane;
      if (lane === null) throw new Error("openable lane");
      const z = row.z != null && Number.isFinite(Number(row.z)) ? Number(row.z) : obj.z;
      return { ...obj, lane, z };
    });
  }
  const stepped = objects.map((obj) => stepProgress(obj, step, animSec));
  const drawn = stepped.map((obj) => decorate(obj, ctx, animSec));
  return {
    rail: RAIL.zones,
    densify: RAIL.densify,
    tileDensify: false,
    coversPlate: false,
    gpu: true,
    composite: GPU.composite,
    bakeIntoDensify: false,
    gradeFromPlate: true,
    hud: false,
    inWorld: true,
    cone: "howlPose",
    clock: "densify",
    sameClock: true,
    lanes: 3,
    raytrace: false,
    paintedOpen: false,
    now,
    animSec,
    state: {
      objects: stepped,
      clock: now,
    },
    objects: drawn,
    lightCues: drawn.map((obj) => obj.lightCue).filter(Boolean),
  };
}

/**
 * Empty list = the frame is keyed states over densify.
 * Any string is a FAIL (painted open, HUD, skipped GPU, raytrace, second cone).
 */
export function assertOpenableNative(frame) {
  const fails = [];
  if (!frame) return ["missing frame"];
  if (frame.tileDensify !== false) fails.push("densify tiled");
  if (frame.coversPlate !== false) fails.push("covers plate");
  if (frame.gpu !== true) fails.push("GPU");
  if (frame.bakeIntoDensify !== false) fails.push("baked into densify");
  if (frame.composite !== "over-densify") fails.push("composite");
  if (frame.hud !== false) fails.push("HUD");
  if (frame.inWorld !== true) fails.push("not in world");
  if (frame.gradeFromPlate !== true) fails.push("gradeFromPlate");
  if (frame.cone !== "howlPose") fails.push("cone");
  if (frame.clock !== "densify") fails.push("clock");
  if (frame.lanes !== 3) fails.push("lanes");
  if (frame.raytrace === true) fails.push("raytrace");
  if (frame.paintedOpen === true) fails.push("painted open");
  for (const obj of frame.objects || []) {
    if (obj.gpu !== true || obj.bakeIntoDensify !== false || obj.composite !== "over-densify") {
      fails.push("baked into densify");
    }
    if (obj.hud !== false) fails.push("HUD");
    if (obj.gradeFromPlate !== true) fails.push("gradeFromPlate");
    if (obj.paintedOpen === true) fails.push("painted open");
    if (!KINDS.includes(obj.kind)) fails.push("kind");
    if (!obj.pose || !obj.pose.dest || obj.cone !== "howlPose") fails.push("cone");
    if (!obj.hit) fails.push("hit");
    if (obj.band === "far" && obj.hittable !== false) fails.push("far hit");
    if (obj.band !== "far" && obj.hittable !== true) fails.push("hit");
    const expect = bibStateOf(obj.phase);
    if (obj.bibState !== expect || !obj.bib || !obj.bib.endsWith(`-${expect}.mp4`)) fails.push("bib state");
    if ((obj.phase === "opening" || obj.phase === "closing") && expect !== "transition") fails.push("transition");
    if (/road-/.test(obj.bib || "")) fails.push("baked into densify");
    if (obj.phase === "open" && obj.content) {
      if (obj.content.gpu !== true || obj.content.bakeIntoDensify !== false) fails.push("content baked into densify");
      if (!obj.content.bib || !obj.content.bib.endsWith("-content.mp4")) fails.push("content");
    }
    if (obj.phase !== "open" && obj.content) fails.push("content");
    if (obj.contact === true && obj.band !== "near") fails.push("shadow outside near");
  }
  return fails;
}
