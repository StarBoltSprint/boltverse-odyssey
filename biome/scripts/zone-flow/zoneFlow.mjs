/**
 * Open-world zone handoff. Invisible placement only.
 *
 * Corridor video rate = boltSpeed / bakedGroundSpeed.
 * Speed under STOP_SPEED is rate 0 and the idle lock.
 * Bolt files are the two lock paths. This module does not cook a clip
 * and does not paint, shade, or colour a world pixel.
 *
 * Gate mouths use clearing.json: heading 0 = +z, 90 = +x.
 */

export const BOLT_GALLOP = "lock/bolt-gallop-cycle.mp4";
export const BOLT_IDLE = "lock/bolt-idle-breath.mp4";
export const STOP_SPEED = 0.05;
export const HITCH_MS = 100;
export const BLACK_LUMA = 12;
export const BLACK_FRAC = 0.92;
export const DEFAULT_FADE_MS = 400;

export function playbackRate(boltSpeed, bakedGroundSpeed) {
  const v = Math.abs(Number(boltSpeed) || 0);
  const baked = Number(bakedGroundSpeed) || 0;
  if (baked <= 0) return 0;
  if (v < STOP_SPEED) return 0;
  return v / baked;
}

export function boltState(boltSpeed) {
  return Math.abs(Number(boltSpeed) || 0) < STOP_SPEED ? "IDLE" : "GALLOP";
}

export function boltClip(boltSpeed) {
  return boltState(boltSpeed) === "IDLE" ? BOLT_IDLE : BOLT_GALLOP;
}

/** Linear crossfade. Sum is 1. Both weights are in (0, 1) while 0 < u < 1. */
export function fadeWeights(u) {
  const t = Math.min(1, Math.max(0, Number(u) || 0));
  if (t <= 0) return { current: 1, next: 0 };
  if (t >= 1) return { current: 0, next: 1 };
  return { current: 1 - t, next: t };
}

export function blackFraction(rgba, lumaMax = BLACK_LUMA) {
  if (!rgba || rgba.length < 3) return 0;
  const channels = rgba.length % 4 === 0 ? 4 : 3;
  const stride = channels * (rgba.length > 200000 ? 16 : 1);
  let n = 0;
  let black = 0;
  for (let i = 0; i + 2 < rgba.length; i += stride) {
    const y = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    n += 1;
    if (y < lumaMax) black += 1;
  }
  return n ? black / n : 0;
}

export function isBlackFrame(rgba) {
  return blackFraction(rgba) >= BLACK_FRAC;
}

export function maxHitch(samples) {
  let m = 0;
  for (const s of samples || []) {
    const h = Number(s && s.hitchMs);
    if (Number.isFinite(h) && h > m) m = h;
  }
  return m;
}

/**
 * Null when there is nothing to judge (caller omits the rows).
 * A sample without `black` or `hitchMs` fails that row: unmeasured is not a PASS.
 */
export function judgeTransition(samples) {
  if (!samples || !samples.length) return null;
  let blacks = 0;
  let measuredBlack = 0;
  let measuredHitch = 0;
  let hitch = 0;
  for (const s of samples) {
    if (s && typeof s.black === "boolean") {
      measuredBlack += 1;
      if (s.black) blacks += 1;
    } else if (s && s.rgba) {
      measuredBlack += 1;
      if (isBlackFrame(s.rgba)) blacks += 1;
    }
    if (s && typeof s.hitchMs === "number" && Number.isFinite(s.hitchMs)) {
      measuredHitch += 1;
      if (s.hitchMs > hitch) hitch = s.hitchMs;
    }
  }
  return {
    black: {
      ok: measuredBlack === samples.length && blacks === 0,
      blacks,
      measured: measuredBlack,
      frames: samples.length,
      lumaMax: BLACK_LUMA,
      frac: BLACK_FRAC,
    },
    hitch: {
      ok: measuredHitch === samples.length && hitch <= HITCH_MS,
      maxHitchMs: hitch,
      measured: measuredHitch,
      frames: samples.length,
      limitMs: HITCH_MS,
    },
  };
}

function angDist(a, b) {
  return Math.abs(((((a - b) % 360) + 540) % 360) - 180);
}

function gateHalfDeg(widthM, radiusM) {
  if (!(radiusM > 0) || !(widthM > 0)) return 0;
  return (Math.atan((widthM * 0.5) / radiusM) * 180) / Math.PI;
}

function gateMouth(clearing, gate) {
  const zone = (clearing && clearing.zone) || {};
  const center = zone.center || [0, 0];
  const ring = (clearing.edge_ring && clearing.edge_ring.radius_m) || zone.radius_m || 0;
  const heading = Number(gate.heading_deg);
  const rad = (heading * Math.PI) / 180;
  const half = gate.half_deg != null ? Number(gate.half_deg) : gateHalfDeg(gate.width_m, ring);
  return {
    id: gate.id,
    heading,
    half,
    leads_to: gate.leads_to || "",
    x: Number(center[0]) + Math.sin(rad) * ring,
    z: Number(center[1] || 0) + Math.cos(rad) * ring,
  };
}

/**
 * world.corridors[]: { id, from:{zone,gate}, to:{zone,gate}, ground, bakedGroundSpeed, length_m }
 * world.zones: id → clearing path (plate comes from the parsed clearing.plate).
 * options.zones: id → parsed clearing.json
 * options.ready(id): false holds the handoff (current plate stays up; no empty frame).
 */
export function createFlow(world, options = {}) {
  const corridors = world.corridors || [];
  const fadeMs = Number(world.fadeMs ?? DEFAULT_FADE_MS);
  const preloadM = Number(world.preloadM ?? 8);
  const triggerM = Number(world.triggerM ?? 1.5);
  const zones = options.zones || {};
  const ready = options.ready || (() => true);

  let mode = "zone";
  let zoneId = world.start;
  let corridor = null;
  let along = 0;
  let fade = null;
  let clock = 0;
  const loaded = new Set();
  const media = {};
  const released = [];

  function clearingOf(id) {
    return zones[id] || null;
  }

  function srcOf(id) {
    const c = corridors.find((item) => item.id === id);
    if (c) return c.ground || "";
    const parsed = clearingOf(id);
    if (parsed && parsed.plate) return parsed.plate;
    const listed = (world.zones || {})[id];
    if (listed && typeof listed === "object" && listed.plate) return listed.plate;
    return "";
  }

  function remember(id, kind) {
    if (!id || loaded.has(id)) return loaded.has(id);
    if (ready(id) === false) return false;
    loaded.add(id);
    media[id] = { id, kind, src: srcOf(id), live: true };
    return true;
  }

  function drop(id) {
    if (!id || !loaded.has(id)) return;
    loaded.delete(id);
    if (media[id]) {
      media[id].live = false;
      media[id].src = "";
    }
    released.push(id);
  }

  remember(zoneId, "zone");

  function outgoing(id) {
    return corridors.filter((c) => c.from && c.from.zone === id);
  }

  function considerGate(c) {
    const parsed = clearingOf(c.from.zone);
    if (!parsed) return null;
    const gate = (parsed.gates || []).find((g) => g.id === c.from.gate);
    if (!gate) return null;
    if (gate.leads_to && gate.leads_to !== c.id) return null;
    return gateMouth(parsed, gate);
  }

  function nearestApproach(x, z) {
    let best = null;
    for (const c of outgoing(zoneId)) {
      const g = considerGate(c);
      if (!g) continue;
      const dist = Math.hypot(x - g.x, z - g.z);
      const bearing = (Math.atan2(g.x - x, g.z - z) * 180) / Math.PI;
      if (!best || dist < best.dist) best = { c, g, dist, bearing };
    }
    return best;
  }

  function facing(best, heading) {
    const aim = best.dist < 0.75 ? best.g.heading : best.bearing;
    return angDist(heading, aim) <= best.g.half + 8;
  }

  function beginFade(kind, fromId, toId, rec) {
    mode = "fade";
    fade = { kind, fromId, toId, t0: clock, rec };
    if (kind === "zone-to-corridor") corridor = rec;
  }

  function completeFade() {
    const done = fade;
    fade = null;
    if (done.kind === "zone-to-corridor") {
      drop(done.fromId);
      mode = "corridor";
      zoneId = null;
      along = 0;
    } else {
      drop(done.fromId);
      mode = "zone";
      zoneId = done.toId;
      corridor = null;
      along = 0;
    }
  }

  function platesFor(weights, speed) {
    const plates = [];
    const bolt = boltClip(speed);
    if (mode === "zone") {
      plates.push({ id: zoneId, kind: "zone", opacity: 1, src: srcOf(zoneId), playbackRate: 0 });
    } else if (mode === "corridor" && corridor) {
      plates.push({
        id: corridor.id,
        kind: "corridor",
        opacity: 1,
        src: corridor.ground,
        playbackRate: playbackRate(speed, corridor.bakedGroundSpeed),
      });
    } else if (mode === "fade" && fade) {
      const fromKind = fade.kind === "zone-to-corridor" ? "zone" : "corridor";
      const toKind = fade.kind === "zone-to-corridor" ? "corridor" : "zone";
      const fromSrc = fromKind === "corridor" ? fade.rec.ground : srcOf(fade.fromId);
      const toSrc = toKind === "corridor" ? fade.rec.ground : srcOf(fade.toId);
      const rate = fade.rec ? playbackRate(speed, fade.rec.bakedGroundSpeed) : 0;
      plates.push({ id: fade.fromId, kind: fromKind, opacity: weights.current, src: fromSrc, playbackRate: fromKind === "corridor" ? rate : 0 });
      plates.push({ id: fade.toId, kind: toKind, opacity: weights.next, src: toSrc, playbackRate: toKind === "corridor" ? rate : 0 });
    }
    plates.push({ id: "bolt", kind: "bolt", opacity: 1, src: bolt, playbackRate: boltState(speed) === "IDLE" ? 1 : 1 });
    return plates;
  }

  function step(pose = {}) {
    const dt = Number(pose.dt) || 0;
    clock += dt;
    const speed = Number(pose.speed ?? pose.spd ?? 0);
    const x = Number(pose.x) || 0;
    const z = Number(pose.z) || 0;
    const heading = Number(pose.heading ?? pose.hdg ?? 0);
    const startMode = mode;
    let held = false;
    const clearedBefore = released.length;

    if (startMode === "zone") {
      const best = nearestApproach(x, z);
      if (best && best.dist <= preloadM) {
        const groundReady = remember(best.c.id, "corridor");
        const nextReady = remember(best.c.to.zone, "zone");
        const aimed = pose.gate ? pose.gate === best.g.id : facing(best, heading);
        if (best.dist <= triggerM && aimed) {
          if (groundReady && nextReady && loaded.has(best.c.id) && loaded.has(best.c.to.zone)) {
            beginFade("zone-to-corridor", zoneId, best.c.id, best.c);
          } else {
            held = true;
          }
        }
      }
    } else if (startMode === "corridor" && corridor) {
      if (Math.abs(speed) >= STOP_SPEED) along += Math.abs(speed) * dt;
      const remain = Number(corridor.length_m) - along;
      if (remain <= preloadM) remember(corridor.to.zone, "zone");
      if (remain <= triggerM) {
        if (loaded.has(corridor.to.zone)) beginFade("corridor-to-zone", corridor.id, corridor.to.zone, corridor);
        else held = true;
      }
    }

    let weights = { current: 1, next: 0 };
    if (mode === "fade" && fade) {
      const span = fadeMs > 0 ? fadeMs / 1000 : 0;
      const u = span <= 0 ? 1 : (clock - fade.t0) / span;
      if (u >= 1) {
        completeFade();
        weights = { current: 1, next: 0 };
      } else {
        weights = fadeWeights(u);
      }
    }

    const rate = corridor && (mode === "corridor" || (fade && fade.kind === "zone-to-corridor"))
      ? playbackRate(speed, corridor.bakedGroundSpeed)
      : 0;
    const black = pose.rgba ? isBlackFrame(pose.rgba) : pose.black === true;
    const hitchMs = typeof pose.hitchMs === "number"
      ? pose.hitchMs
      : typeof pose.frameMs === "number"
        ? pose.frameMs
        : dt * 1000;

    return {
      mode,
      zoneId,
      corridorId: corridor ? corridor.id : null,
      along,
      rate,
      bolt: boltState(speed),
      clip: boltClip(speed),
      weights,
      held,
      black,
      hitchMs,
      loaded: [...loaded],
      unloaded: released.slice(),
      cleared: released.slice(clearedBefore),
      plates: platesFor(weights, speed),
    };
  }

  return {
    step,
    media() {
      return Object.fromEntries(Object.entries(media).map(([k, v]) => [k, { ...v }]));
    },
  };
}
