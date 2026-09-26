import type { Band, LodRow } from "./types";

/**
 * Cheap alpha for Imagine cards. Kitchen policy. Does not import three.
 * Fill rate is the cost. The curve is not.
 * Resting near / mid / far stay cutout. Blend only while a band change dissolves.
 * The capsule is not in this file. Hit snaps on the hysteresis line in lod.ts.
 */

/** Hung duration for a single card. Inside 220–280 ms, shorter than the 2–8 m hysteresis belt. */
export const FADE_MS = 250;
export const FADE_MS_MIN = 220;
export const FADE_MS_MAX = 280;
/** Impostor-only far↔cull. One slot. Not the bole. */
export const FADE_MS_IMP = 180;
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
  /** Impostor quad only. 1 on every other edge. Never 0. */
  quadScale: number;
};

type Slot = {
  id: string;
  from: Band;
  to: Band;
  t0: number;
  /** 180 impostor, 220 crown, 250 card, 280 bole↔impostor. One slot per tree. */
  ms: number;
  dist: number;
  /** Nearest 24. A farther tree does not steal their slot. */
  priority: boolean;
  /** Set when a far↔cull fade reverses. Scale grows from here. */
  shrinkScale0?: number;
  shrinkAlpha0?: number;
};

const slots = new Map<string, Slot>();
/** Last settled look band. First sight snaps. Not a collision cache. */
const settled = new Map<string, Band>();
const seen = new Set<string>();
/** Previous frame distance. A belt-sized jump does not start a shrink. */
const lastDist = new Map<string, number>();
/** Grew back inside the 8 m belt while the gate still says cull. Scale stays 1. */
const heldGrow = new Set<string>();

export function activeFadeCount(): number {
  return slots.size;
}

export function resetFadeState(): void {
  slots.clear();
  settled.clear();
  seen.clear();
  lastDist.clear();
  heldGrow.clear();
}

/** Drop fade memory for ids that left the memory ring. */
export function forgetFades(ids: Iterable<string>): void {
  for (const id of ids) {
    slots.delete(id);
    settled.delete(id);
    seen.delete(id);
    lastDist.delete(id);
    heldGrow.delete(id);
  }
}

/** A fade in flight. Stashed when the mesh leaves geo. Not a bandDraw. */
export type FadeStash = { from: Band; to: Band; t0: number; ms: number };

/** Pull the live slot off the mesh. Settled band stays. A geo drop calls this. */
export function liftFade(id: string): FadeStash | undefined {
  const slot = slots.get(id);
  if (!slot) return undefined;
  slots.delete(id);
  return { from: slot.from, to: slot.to, t0: slot.t0, ms: slot.ms };
}

export function fadingIds(): string[] {
  return [...slots.keys()];
}

export function fadeU(id: string, nowMs: number): number | undefined {
  const slot = slots.get(id);
  if (!slot) return undefined;
  return (nowMs - slot.t0) / slot.ms;
}

/** Put a stashed fade back when the kit returns. A full cap leaves it down. */
export function restoreFade(id: string, stash: FadeStash): void {
  if (slots.has(id) || slots.size >= FADE_CAP) return;
  slots.set(id, {
    id,
    from: stash.from,
    to: stash.to,
    t0: stash.t0,
    ms: stash.ms,
    dist: Number.POSITIVE_INFINITY,
    priority: false,
  });
}

/**
 * Far ↔ cull only. Horizon specks shrink, then die.
 * Mid ↔ far and near ↔ mid stay world size.
 * Lockstep with lod.ts BANDS.far: enter 72, leave 80. The shrink does not move that gate.
 */
export const FAR_SHRINK_MS = 180;
export const FAR_SHRINK_SCALE = 0.35;
export const FAR_ENTER_M = 72;
export const FAR_LEAVE_M = 80;
export const FAR_BELT_M = FAR_LEAVE_M - FAR_ENTER_M;

export function isShrinkEdge(from: Band, to: Band): boolean {
  return (from === "far" && to === "cull") || (from === "cull" && to === "far");
}

/** One tick from the enter line past the leave line, farther than the belt. 72 → 90 snaps. */
export function skippedFarBelt(prevDist: number, dist: number): boolean {
  return prevDist <= FAR_ENTER_M && dist >= FAR_LEAVE_M && dist - prevDist > FAR_BELT_M;
}

export function farShrink(
  from: Band,
  to: Band,
  u: number,
  carry?: { scale: number; opacity: number },
): { scale: number; opacity: number } {
  if (!isShrinkEdge(from, to)) return { scale: 1, opacity: 1 };
  const t = smoothstep(u);
  if (carry) {
    const endScale = to === "cull" ? FAR_SHRINK_SCALE : 1;
    const endAlpha = to === "cull" ? 0 : 1;
    return {
      scale: Math.max(FAR_SHRINK_SCALE, carry.scale + (endScale - carry.scale) * t),
      opacity: carry.opacity + (endAlpha - carry.opacity) * t,
    };
  }
  if (from === "far") {
    return { scale: 1 + (FAR_SHRINK_SCALE - 1) * t, opacity: 1 - t };
  }
  return { scale: FAR_SHRINK_SCALE + (1 - FAR_SHRINK_SCALE) * t, opacity: t };
}

export function fadeMs(id: string): number | undefined {
  return slots.get(id)?.ms;
}

/** Live impostor scale. Undefined when this id is not on the shrink edge. */
export function shrinkSample(id: string, nowMs: number): { scale: number; opacity: number } | undefined {
  const slot = slots.get(id);
  if (!slot || !isShrinkEdge(slot.from, slot.to)) return undefined;
  const u = (nowMs - slot.t0) / slot.ms;
  if (slot.shrinkScale0 !== undefined && slot.shrinkAlpha0 !== undefined) {
    return farShrink(slot.from, slot.to, u, { scale: slot.shrinkScale0, opacity: slot.shrinkAlpha0 });
  }
  return farShrink(slot.from, slot.to, u);
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
    quadScale: 1,
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
    quadScale: 1,
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

function flagsFor(
  from: Band,
  to: Band,
  u: number,
  fading: boolean,
  carry?: { scale: number; opacity: number },
): CheapAlpha {
  if (isShrinkEdge(from, to)) {
    const shrunk = farShrink(from, to, u, carry);
    if (shrunk.opacity < ALPHA_SKIP) return skip(fading);
    return {
      path: "blend",
      a: shrunk.opacity,
      picture: "impostor",
      transparent: true,
      depthWrite: false,
      alphaTest: 0,
      premultiplied: true,
      side: "front",
      visible: true,
      fading: true,
      quadScale: shrunk.scale,
    };
  }
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
    quadScale: 1,
  };
}

/** Lockstep with twoPlane: crown 220, bole↔impostor 280, impostor 180. One slot per tree. */
function edgeMs(from: Band, to: Band): number {
  const pair = (a: Band, b: Band) => (from === a && to === b) || (from === b && to === a);
  if (pair("near", "mid")) return 220;
  if (pair("mid", "far")) return 280;
  if (pair("far", "cull")) return FADE_MS_IMP;
  return FADE_MS;
}

/**
 * bandDraw changed. One slot per tree, not per plane.
 * Near↔mid is the crown, 220 ms. A promote reverses from the current t.
 * Cap 8. The nearest 24 win. A full cap snaps the farthest slot.
 * nowMs is milliseconds. Pass bandDraw, not holdBand.
 */
export function requestFade(
  id: string,
  from: Band,
  to: Band,
  nowMs: number,
  durationMs: number = FADE_MS,
  dist: number = Number.POSITIVE_INFINITY,
  priority: boolean = false,
): "fade" | "snap" {
  if (from === to) {
    settled.set(id, to);
    return "snap";
  }
  const existing = slots.get(id);
  if (existing) {
    if (existing.to === to && existing.from === from) {
      existing.dist = dist;
      existing.priority = priority;
      return "fade";
    }
    if (existing.from === to && existing.to === from) {
      const u = Math.min(1, Math.max(0, (nowMs - existing.t0) / existing.ms));
      if (isShrinkEdge(existing.from, existing.to)) {
        const newMs = FAR_SHRINK_MS * (1 - u);
        if (newMs < 1) {
          slots.delete(id);
          settled.set(id, to);
          return "snap";
        }
        const origin = existing.shrinkScale0 !== undefined && existing.shrinkAlpha0 !== undefined
          ? farShrink(existing.from, existing.to, u, { scale: existing.shrinkScale0, opacity: existing.shrinkAlpha0 })
          : farShrink(existing.from, existing.to, u);
        slots.set(id, {
          id,
          from,
          to,
          t0: nowMs,
          ms: newMs,
          dist,
          priority,
          shrinkScale0: origin.scale,
          shrinkAlpha0: origin.opacity,
        });
        return "fade";
      }
      const rev = 1 - u;
      const ms = edgeMs(from, to);
      slots.set(id, { id, from, to, t0: nowMs - rev * ms, ms, dist, priority });
      return "fade";
    }
    slots.delete(id);
    settled.set(id, to);
    return "snap";
  }
  if (slots.size >= FADE_CAP) {
    let victim: Slot | undefined;
    for (const slot of slots.values()) {
      if (!victim || slot.dist > victim.dist) victim = slot;
    }
    const nearer = priority && victim !== undefined && (!victim.priority || dist < victim.dist);
    if (nearer && victim) {
      slots.delete(victim.id);
      settled.set(victim.id, victim.to);
    } else {
      settled.set(id, to);
      return "snap";
    }
  }
  const ms = durationMs === edgeMs(from, to) || durationMs === FADE_MS
    ? edgeMs(from, to)
    : durationMs;
  slots.set(id, { id, from, to, t0: nowMs, ms, dist, priority });
  return "fade";
}

/** Drop finished slots. applyCheapAlpha calls this once per frame. */
export function tickFades(nowMs: number): void {
  for (const [id, slot] of slots) {
    if (nowMs - slot.t0 >= slot.ms && !isShrinkEdge(slot.from, slot.to)) {
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
export function resolveCheapAlpha(
  id: string,
  band: Band,
  nowMs: number,
  dist: number = Number.POSITIVE_INFINITY,
  priority: boolean = false,
): CheapAlpha {
  seen.add(id);
  const prevD = lastDist.get(id);
  const leapt = prevD !== undefined && band === "cull" && skippedFarBelt(prevD, dist);
  lastDist.set(id, dist);
  if (leapt) {
    slots.delete(id);
    heldGrow.delete(id);
    settled.set(id, "cull");
    return skip(false);
  }

  let slot = slots.get(id);
  if (slot && isShrinkEdge(slot.from, slot.to)) {
    const want: Band = dist >= FAR_LEAVE_M ? "cull" : "far";
    if (slot.to !== want) {
      requestFade(id, slot.to, want, nowMs, FAR_SHRINK_MS, dist, priority);
      slot = slots.get(id);
    }
    if (slot && isShrinkEdge(slot.from, slot.to)) {
      const u = (nowMs - slot.t0) / slot.ms;
      if (u >= 1) {
        slots.delete(id);
        if (slot.to === "far" && band !== "far" && dist < FAR_LEAVE_M) {
          heldGrow.add(id);
          settled.set(id, "far");
          return cutout("impostor", false);
        }
        heldGrow.delete(id);
        settled.set(id, slot.to);
        return slot.to === "cull" ? skip(false) : idle(slot.to);
      }
      const carry = slot.shrinkScale0 !== undefined && slot.shrinkAlpha0 !== undefined
        ? { scale: slot.shrinkScale0, opacity: slot.shrinkAlpha0 }
        : undefined;
      return flagsFor(slot.from, slot.to, u, true, carry);
    }
  }

  if (heldGrow.has(id)) {
    if (band !== "far" && dist < FAR_LEAVE_M) return cutout("impostor", false);
    heldGrow.delete(id);
  }

  slot = slots.get(id);
  if (slot) {
    if (slot.to !== band) {
      const mode = requestFade(id, slot.to, band, nowMs, edgeMs(slot.to, band), dist, priority);
      if (mode === "snap") return idle(band);
      const revived = slots.get(id);
      if (!revived) return idle(band);
      const u = (nowMs - revived.t0) / revived.ms;
      const carry = revived.shrinkScale0 !== undefined && revived.shrinkAlpha0 !== undefined
        ? { scale: revived.shrinkScale0, opacity: revived.shrinkAlpha0 }
        : undefined;
      return flagsFor(revived.from, revived.to, u, true, carry);
    }
    const u = (nowMs - slot.t0) / slot.ms;
    if (u >= 1) {
      slots.delete(id);
      settled.set(id, band);
      return idle(band);
    }
    return flagsFor(slot.from, slot.to, u, true);
  }

  if (band === "cull" && settled.get(id) === "far" && dist < FAR_LEAVE_M) {
    return cutout("impostor", false);
  }

  const prev = settled.get(id);
  if (prev === undefined) {
    settled.set(id, band);
    return idle(band);
  }
  if (prev === band) return idle(band);

  const mode = requestFade(id, prev, band, nowMs, edgeMs(prev, band), dist, priority);
  if (mode === "snap") return idle(band);
  return flagsFor(prev, band, 0, true);
}

/**
 * Uniforms for card.frag.glsl (law 45 alpha chain).
 * Mask instance: uCutout 1, FadeAlpha 1, Cutoff 0.45.
 * Fade instance: uCutout 0, FadeAlpha = coverage, Cutoff 0.02.
 * uAlpha is the same scalar as uFadeAlpha.
 */
export function cheapAlphaUniforms(alpha: CheapAlpha): {
  uAlpha: number;
  uFadeAlpha: number;
  uCutout: number;
  uCutoff: number;
} {
  const fadeAlpha = alpha.path === "skip" ? 0 : alpha.a;
  const cutout = alpha.path === "cutout" ? 1 : 0;
  return {
    uAlpha: fadeAlpha,
    uFadeAlpha: fadeAlpha,
    uCutout: cutout,
    uCutoff: cutout ? ALPHA_TEST : ALPHA_SKIP,
  };
}
