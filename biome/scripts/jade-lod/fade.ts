import type { Band, LodRow } from "./types";

/**
 * Cheap alpha for Imagine cards. Kitchen policy. Does not import three.
 * Fill rate is the cost. The curve is not.
 * Resting near / mid / far stay cutout. Blend only while a band change dissolves.
 * The capsule is not in this file. Hit snaps on the hysteresis line in lod.ts.
 */

/** Hung duration. Inside 220–280 ms, shorter than the 2–8 m hysteresis belt. */
export const FADE_MS = 250;
export const FADE_MS_MIN = 220;
export const FADE_MS_MAX = 280;
export const FADE_CAP = 8;
export const ALPHA_SKIP = 0.02;
export const ALPHA_TEST = 0.45;

export type AlphaPath = "cutout" | "blend" | "skip";
type Picture = LodRow["picture"];

export type CheapAlpha = {
  path: AlphaPath;
  /** Coverage 0..1. Idle cutout is 1. Skip is 0. */
  a: number;
  picture: Picture;
  transparent: boolean;
  depthWrite: boolean;
  /** 0.45 on cutout. 0 on blend and skip. Lockstep with card.frag.glsl. */
  alphaTest: number;
  /** Blend only. Remix: gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA). */
  premultiplied: boolean;
  /** 70/30 yaw already faces the camera. Never DoubleSide. */
  side: "front";
  visible: boolean;
  /** True while this id holds one of the 8 slots, including the opaque endpoints. */
  fading: boolean;
};

type Slot = {
  id: string;
  from: Band;
  to: Band;
  t0: number;
};

const slots = new Map<string, Slot>();
/** Last settled look band. First sight snaps. Not a collision cache. */
const settled = new Map<string, Band>();
const seen = new Set<string>();

export function activeFadeCount(): number {
  return slots.size;
}

export function resetFadeState(): void {
  slots.clear();
  settled.clear();
  seen.clear();
}

function pictureOf(band: Band): Picture {
  if (band === "near") return "full";
  if (band === "mid") return "bole";
  if (band === "far") return "impostor";
  return "none";
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function cutout(picture: Picture, fading: boolean): CheapAlpha {
  return {
    path: "cutout",
    a: 1,
    picture,
    transparent: false,
    depthWrite: true,
    alphaTest: ALPHA_TEST,
    premultiplied: false,
    side: "front",
    visible: true,
    fading,
  };
}

function skip(fading: boolean): CheapAlpha {
  return {
    path: "skip",
    a: 0,
    picture: "none",
    transparent: false,
    depthWrite: false,
    alphaTest: 0,
    premultiplied: false,
    side: "front",
    visible: false,
    fading,
  };
}

function idle(band: Band): CheapAlpha {
  const picture = pictureOf(band);
  if (picture === "none") return skip(false);
  return cutout(picture, false);
}

/**
 * One slot, one dissolve.
 * cull → card fades in over FADE_MS. card → cull fades out over FADE_MS.
 * Two pictures crossfade inside the same window (out, then in).
 */
export function dissolveSample(
  from: Band,
  to: Band,
  u: number,
): { a: number; picture: Picture } {
  const fromPic = pictureOf(from);
  const toPic = pictureOf(to);
  const t = Math.min(1, Math.max(0, u));
  if (fromPic === "none" && toPic !== "none") {
    return { a: smoothstep(t), picture: toPic };
  }
  if (toPic === "none") {
    return { a: 1 - smoothstep(t), picture: fromPic };
  }
  if (t < 0.5) return { a: 1 - smoothstep(t * 2), picture: fromPic };
  return { a: smoothstep((t - 0.5) * 2), picture: toPic };
}

function flagsFor(from: Band, to: Band, u: number, fading: boolean): CheapAlpha {
  const { a, picture } = dissolveSample(from, to, u);
  if (picture === "none" || a < ALPHA_SKIP) return skip(fading);
  if (a >= 0.999) return cutout(picture, fading);
  return {
    path: "blend",
    a,
    picture,
    transparent: true,
    depthWrite: false,
    alphaTest: 0,
    premultiplied: true,
    side: "front",
    visible: true,
    fading,
  };
}

/**
 * Band changed on the hysteresis line.
 * One slot per id. Cap 8. A full cap snaps. A second change on the same id snaps.
 * nowMs is milliseconds.
 */
export function requestFade(
  id: string,
  from: Band,
  to: Band,
  nowMs: number,
): "fade" | "snap" {
  if (from === to) {
    settled.set(id, to);
    return "snap";
  }
  if (slots.has(id) || slots.size >= FADE_CAP) {
    slots.delete(id);
    settled.set(id, to);
    return "snap";
  }
  slots.set(id, { id, from, to, t0: nowMs });
  return "fade";
}

/** Drop finished slots. applyCheapAlpha calls this once per frame. */
export function tickFades(nowMs: number): void {
  for (const [id, slot] of slots) {
    if (nowMs - slot.t0 >= FADE_MS) {
      slots.delete(id);
      settled.set(id, slot.to);
    }
  }
  if (settled.size > 4000) {
    for (const id of settled.keys()) {
      if (!seen.has(id) && !slots.has(id)) settled.delete(id);
    }
  }
  seen.clear();
}

/**
 * Look alpha for one row. First sight snaps to cutout (or skip if culled).
 * Closer kits should call this first: the first eight band changes keep the slots.
 */
export function resolveCheapAlpha(id: string, band: Band, nowMs: number): CheapAlpha {
  seen.add(id);
  const slot = slots.get(id);
  if (slot) {
    if (slot.to !== band) {
      slots.delete(id);
      settled.set(id, band);
      return idle(band);
    }
    const u = (nowMs - slot.t0) / FADE_MS;
    if (u >= 1) {
      slots.delete(id);
      settled.set(id, band);
      return idle(band);
    }
    return flagsFor(slot.from, slot.to, u, true);
  }

  const prev = settled.get(id);
  if (prev === undefined) {
    settled.set(id, band);
    return idle(band);
  }
  if (prev === band) return idle(band);

  const mode = requestFade(id, prev, band, nowMs);
  if (mode === "snap") return idle(band);
  return flagsFor(prev, band, 0, true);
}

/** Uniforms for card.frag.glsl. uCutout 1 = idle/opaque cutout, 0 = dissolve blend. */
export function cheapAlphaUniforms(alpha: CheapAlpha): { uAlpha: number; uCutout: number } {
  return {
    uAlpha: alpha.path === "skip" ? 0 : alpha.a,
    uCutout: alpha.path === "cutout" ? 1 : 0,
  };
}
