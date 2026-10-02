/**
 * Fade-in and preload-ahead measurements. No pixels are drawn.
 * Owner decree #457, approved 2026-10-02: a ramp is 300–600 ms, or the configured distance.
 * Spec rail 11: a jump above 20% of the final value in one frame fails (same 20% figure as no_pop).
 * An object already visible as its far representation crossfades. It does not vanish first.
 * Alpha starts at 0 only when the object was off screen.
 */

const FADE_MS_MIN = 300;
const FADE_MS_MAX = 600;
const JUMP_FRAC = 0.2;
const PATH_STEP_M = 2;
const FAR_REPS = new Set(["far", "impostor", "lod2"]);

function na(name) {
  return `n/a (page lacks field ${name})`;
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function wrap360(a) {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}

function angDist(a, b) {
  let d = wrap360(a - b);
  if (d > 180) d = 360 - d;
  return d;
}

function headingOf(dx, dz) {
  return wrap360((Math.atan2(dx, dz) * 180) / Math.PI);
}

function row(id, result, numbers, detail, partial = false) {
  return { id, result, numbers, detail, heuristic: false, partial };
}

export function predictHeadingPath(sample, lookaheadM) {
  const look = finite(lookaheadM);
  const x0 = finite(sample && sample.x) ?? 0;
  const z0 = finite(sample && sample.z) ?? 0;
  let hdg = finite(sample && sample.hdg);
  if (hdg == null) {
    const vx = finite(sample && sample.vx);
    const vz = finite(sample && sample.vz);
    hdg = vx != null && vz != null ? headingOf(vx, vz) : 0;
  }
  const rad = (hdg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dz = Math.cos(rad);
  const points = [];
  if (look != null && look > 0) {
    const steps = Math.max(1, Math.round(look / PATH_STEP_M));
    for (let i = 1; i <= steps; i++) {
      const d = Math.min(PATH_STEP_M * i, look);
      points.push({ x: x0 + dx * d, z: z0 + dz * d, distance_m: d });
      if (d >= look - 1e-9) break;
    }
    const last = points[points.length - 1];
    const reached = last ? Math.hypot(last.x - x0, last.z - z0) : 0;
    if (!last || Math.abs(reached - look) > 1e-6) {
      points.push({ x: x0 + dx * look, z: z0 + dz * look, distance_m: look });
    }
  }
  return { points, lookahead_m: look };
}

function bag(sample) {
  if (!sample || typeof sample !== "object") return null;
  if (sample.opacity && typeof sample.opacity === "object") return sample.opacity;
  if (sample.areas && typeof sample.areas === "object") return sample.areas;
  if (sample.counts && typeof sample.counts === "object" && !Array.isArray(sample.counts)) return sample.counts;
  return null;
}

function valueOf(sample, id) {
  const source = bag(sample);
  if (!source || !Object.prototype.hasOwnProperty.call(source, id)) return null;
  return finite(source[id]);
}

function repOf(sample, id) {
  const reps = sample && sample.representation;
  if (reps && typeof reps === "object" && reps[id] != null) return String(reps[id]);
  return null;
}

function flagged(sample, key, id) {
  const value = sample && sample[key];
  if (value == null) return false;
  if (value === true) return true;
  if (typeof value === "object") return !!value[id];
  return false;
}

function onScreen(sample, id) {
  if (!sample || !Array.isArray(sample.frustum)) return false;
  if (!sample.frustum.map(String).includes(String(id))) return false;
  if (flagged(sample, "occluded", id) || flagged(sample, "beyondFog", id)) return false;
  return true;
}

function wasFar(sample, id) {
  if (FAR_REPS.has(repOf(sample, id))) return true;
  return flagged(sample, "far", id);
}

function idsOf(samples) {
  const ids = new Set();
  for (const sample of samples) {
    const source = bag(sample);
    if (source) for (const id of Object.keys(source)) ids.add(String(id));
    const reps = sample && sample.representation;
    if (reps && typeof reps === "object") for (const id of Object.keys(reps)) ids.add(String(id));
  }
  return [...ids];
}

function distanceOf(sample, id) {
  if (!sample) return null;
  const direct = finite(sample.distance_m);
  if (direct != null) return direct;
  const bagDistance = sample.distance;
  if (bagDistance && typeof bagDistance === "object" && bagDistance[id] != null) return finite(bagDistance[id]);
  return null;
}

export function evaluateFadeIn(samples, streaming) {
  const list = Array.isArray(samples) ? samples : [];
  const stream = streaming && typeof streaming === "object" ? streaming : {};
  const distLimit = finite(stream.fade_in_distance_m);
  const ids = idsOf(list);
  const sawValue = list.some((sample) => bag(sample));
  const vanishedIds = [];

  for (const id of ids) {
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const next = list[i];
      const prevV = valueOf(prev, id);
      const nextV = valueOf(next, id);
      const dropped = nextV != null && nextV <= 1e-9;
      if (wasFar(prev, id) && prevV != null && prevV > 1e-9 && dropped && onScreen(prev, id) && onScreen(next, id)) {
        vanishedIds.push(id);
        break;
      }
    }
  }

  let count = 0;
  let worstJump = 0;
  let worstRamp = null;
  let worstScore = -1;
  let anyUnmeasured = false;
  let durationFail = false;
  let jumpFail = false;
  let monoFail = false;

  for (const id of ids) {
    const series = [];
    for (let i = 0; i < list.length; i++) {
      const v = valueOf(list[i], id);
      if (v == null) continue;
      series.push({ v, t: finite(list[i].t_ms), d: distanceOf(list[i], id) });
    }
    if (series.length < 2) continue;
    const full = Math.max(...series.map((item) => item.v));
    if (!(full > 0)) continue;
    const eps = Math.max(1e-9, Math.abs(full) * 1e-9);
    if (series[0].v >= full - eps) continue;
    const endIdx = series.findIndex((item) => item.v >= full - eps);
    if (endIdx <= 0) continue;
    let dipped = false;
    for (let k = 1; k <= endIdx; k++) {
      if (series[k].v + eps < series[k - 1].v) dipped = true;
    }
    let startIdx = endIdx;
    while (startIdx > 0 && series[startIdx - 1].v <= series[startIdx].v + eps) startIdx -= 1;
    const window = series.slice(startIdx, endIdx + 1);
    count += 1;
    if (dipped) monoFail = true;
    let localJump = 0;
    for (let k = 1; k < window.length; k++) {
      const delta = window[k].v - window[k - 1].v;
      if (delta < -eps) monoFail = true;
      const frac = delta > 0 ? delta / full : 0;
      if (frac > localJump) localJump = frac;
    }
    if (localJump > worstJump) worstJump = localJump;
    if (localJump > JUMP_FRAC) jumpFail = true;
    const t0 = window[0].t;
    const t1 = window[window.length - 1].t;
    if (t0 == null || t1 == null) {
      anyUnmeasured = true;
      continue;
    }
    const dt = t1 - t0;
    const timeOk = dt >= FADE_MS_MIN - 1e-6 && dt <= FADE_MS_MAX + 1e-6;
    let distOk = false;
    if (!timeOk && distLimit != null && distLimit > 0) {
      const d0 = window[0].d;
      const d1 = window[window.length - 1].d;
      if (d0 != null && d1 != null) {
        const span = Math.abs(d1 - d0);
        if (span > 0 && span <= distLimit + 1e-9) distOk = true;
      }
    }
    if (!timeOk && !distOk) durationFail = true;
    const score = dt < FADE_MS_MIN ? FADE_MS_MIN - dt : dt > FADE_MS_MAX ? dt - FADE_MS_MAX : 0;
    if (worstRamp == null || score > worstScore || (score === worstScore && dt > worstRamp)) {
      worstRamp = dt;
      worstScore = score;
    }
  }

  const vanished = vanishedIds.length;
  let result = "PASS";
  let partial = false;
  if (jumpFail || monoFail || durationFail || vanished > 0) result = "FAIL";
  else if (count > 0 && anyUnmeasured) partial = true;
  else if (count === 0 && !sawValue) partial = true;

  const numbers = {
    count,
    worst_jump: worstJump,
    worst_ramp_ms: count === 0 ? (sawValue ? null : na("opacity")) : worstRamp == null ? na("t_ms") : worstRamp,
    vanished,
    worst_id: vanishedIds[0] || null,
  };
  const rampText = typeof numbers.worst_ramp_ms === "number" ? String(numbers.worst_ramp_ms) : numbers.worst_ramp_ms;
  const detail = vanished
    ? `${vanishedIds[0]} was visible as its far representation and dropped to 0 while still on screen. Crossfade from that representation. Owner decree #457, approved 2026-10-02. Spec rail 11.`
    : result === "FAIL"
      ? `count=${count} worst_ramp_ms=${rampText} worst_jump=${worstJump}. A jump above ${JUMP_FRAC} of the final value in one frame fails. Ramp is ${FADE_MS_MIN}–${FADE_MS_MAX} ms (owner decree #457, approved 2026-10-02) or the configured distance. Spec rail 11.`
      : count === 0 && !sawValue
        ? na("opacity")
        : `count=${count} worst_ramp_ms=${rampText} worst_jump=${worstJump}. Owner decree #457, approved 2026-10-02. Spec rail 11.`;
  return row("fade_in", result, numbers, detail, partial);
}

function centreOf(cell) {
  const aabb = cell && cell.aabb;
  if (!Array.isArray(aabb) || aabb.length < 2) return null;
  const minx = finite(aabb[0][0]);
  const minz = finite(aabb[0][1]);
  const maxx = finite(aabb[1][0]);
  const maxz = finite(aabb[1][1]);
  if (minx == null || minz == null || maxx == null || maxz == null) return null;
  return { x: (minx + maxx) / 2, z: (minz + maxz) / 2 };
}

function contains(cell, x, z) {
  const aabb = cell && cell.aabb;
  if (!Array.isArray(aabb) || aabb.length < 2) return false;
  const xs = [finite(aabb[0][0]), finite(aabb[1][0])].filter((n) => n != null);
  const zs = [finite(aabb[0][1]), finite(aabb[1][1])].filter((n) => n != null);
  if (xs.length < 2 || zs.length < 2) return false;
  const minx = Math.min(...xs);
  const maxx = Math.max(...xs);
  const minz = Math.min(...zs);
  const maxz = Math.max(...zs);
  return x >= minx - 1e-6 && x <= maxx + 1e-6 && z >= minz - 1e-6 && z <= maxz + 1e-6;
}

function pageDeclaresStreaming(sample) {
  if (!sample || typeof sample !== "object") return false;
  if (sample.streaming) return true;
  const cells = sample.cells || sample.cellPerf;
  return !!(cells && typeof cells === "object" && cells.streaming === true);
}

function streamingDeclared(layout, samples) {
  const block = layout && layout.streaming;
  if (block && typeof block === "object" && !Array.isArray(block)) return true;
  return (Array.isArray(samples) ? samples : []).some(pageDeclaresStreaming);
}

function residentIdsOf(sample) {
  const cells = sample && (sample.cells || sample.cellPerf);
  if (!cells || typeof cells !== "object") return null;
  if (Array.isArray(cells.residentIds)) return cells.residentIds.map(String);
  if (Array.isArray(cells.resident) && cells.resident.every((item) => typeof item === "string")) return cells.resident.map(String);
  return null;
}

function cellsInCone(cells, x, z, hdg, lookahead, coneDeg) {
  const half = coneDeg / 2;
  const out = [];
  for (const cell of cells) {
    const id = String(cell.id);
    if (contains(cell, x, z)) continue;
    const centre = centreOf(cell);
    if (!centre) continue;
    const dx = centre.x - x;
    const dz = centre.z - z;
    if (Math.hypot(dx, dz) > lookahead + 1e-6) continue;
    if (angDist(headingOf(dx, dz), hdg) <= half + 1e-6) out.push(id);
  }
  return out;
}

export function evaluatePreloadAhead(samples, layout) {
  const list = Array.isArray(samples) ? samples : [];
  const stream = (layout && layout.streaming) || {};
  const cells = Array.isArray(layout && layout.cells) ? layout.cells : [];
  const look = finite(stream.preload_lookahead_m);
  const cone = finite(stream.preload_cone_deg);
  const declared = streamingDeclared(layout, list);
  const measuredIds = list.filter((sample) => residentIdsOf(sample));
  if (declared && !measuredIds.length) {
    const msg = "missing field residentIds";
    return row(
      "preload_ahead",
      "FAIL",
      { residentIds: msg, misses: msg, miss_ids: msg, worst_lead_ms: msg },
      msg,
      false,
    );
  }
  if (look == null || cone == null) {
    const missing = look == null ? "preload_lookahead_m" : "preload_cone_deg";
    const msg = na(missing);
    return row("preload_ahead", "PASS", { residentIds: msg, misses: msg, worst_lead_ms: msg }, msg, true);
  }
  const measured = list.filter((sample) => residentIdsOf(sample));
  if (!measured.length) {
    const msg = na("cells.residentIds");
    return row(
      "preload_ahead",
      "PASS",
      { residentIds: msg, misses: msg, miss_ids: msg, worst_lead_ms: msg },
      msg,
      true,
    );
  }

  const misses = new Set();
  const lastResident = new Map();
  let prevContaining = new Set();
  let worstLead = null;
  let leadUnmeasured = false;
  let index = 0;
  for (const sample of list) {
    const ids = residentIdsOf(sample);
    if (!ids) {
      index += 1;
      continue;
    }
    const t = finite(sample.t_ms);
    const x = finite(sample.x) ?? 0;
    const z = finite(sample.z) ?? 0;
    let hdg = finite(sample.hdg);
    if (hdg == null) {
      const vx = finite(sample.vx);
      const vz = finite(sample.vz);
      hdg = vx != null && vz != null ? headingOf(vx, vz) : 0;
    }
    const containing = cells.filter((cell) => contains(cell, x, z)).map((cell) => String(cell.id));
    for (const id of cellsInCone(cells, x, z, hdg, look, cone)) {
      if (!ids.includes(id)) misses.add(id);
    }
    if (index > 0) {
      for (const id of containing) {
        if (prevContaining.has(id)) continue;
        const prevT = lastResident.has(id) ? lastResident.get(id) : null;
        if (prevT == null) {
          misses.add(id);
        } else if (t == null) {
          leadUnmeasured = true;
        } else if (!(prevT < t)) {
          misses.add(id);
        } else {
          const lead = t - prevT;
          if (worstLead == null || lead < worstLead) worstLead = lead;
        }
      }
    }
    prevContaining = new Set(containing);
    for (const id of ids) {
      if (t != null) lastResident.set(id, t);
    }
    index += 1;
  }

  const missIds = [...misses].sort();
  const result = missIds.length ? "FAIL" : "PASS";
  const numbers = {
    misses: missIds.length,
    miss_ids: missIds,
    worst_lead_ms: worstLead == null ? (leadUnmeasured ? na("t_ms") : null) : worstLead,
    lookahead_m: look,
    cone_deg: cone,
    path_points: list.length ? predictHeadingPath(list[0], look).points.length : 0,
  };
  const detail = result === "FAIL"
    ? `misses=${missIds.length} miss_ids=${missIds.join(",") || "none"} worst_lead_ms=${numbers.worst_lead_ms}. A cell inside the heading cone must be resident before the hero enters it. Owner decree #457, approved 2026-10-02. Spec rail 11.`
    : `misses=0 worst_lead_ms=${numbers.worst_lead_ms}. Owner decree #457, approved 2026-10-02. Spec rail 11.`;
  return row("preload_ahead", result, numbers, detail, leadUnmeasured && result === "PASS");
}

export function fadeSamplesFromFrames(frames) {
  const out = [];
  for (const frame of frames || []) {
    const snap = (frame && frame.snap) || {};
    const sample = {};
    let any = false;
    if (snap.opacity && typeof snap.opacity === "object") {
      sample.opacity = snap.opacity;
      any = true;
    } else if (snap.areas && typeof snap.areas === "object") {
      sample.areas = snap.areas;
      any = true;
    } else if (frame && frame.counts && frame.counts.size) {
      const areas = {};
      for (const [key, value] of frame.counts) areas[key] = value;
      sample.areas = areas;
      any = true;
    }
    if (snap.representation) {
      sample.representation = snap.representation;
      any = true;
    }
    if (Array.isArray(snap.frustum)) {
      sample.frustum = snap.frustum;
      any = true;
    }
    if (snap.occluded != null) sample.occluded = snap.occluded;
    if (snap.beyondFog != null) sample.beyondFog = snap.beyondFog;
    if (snap.far != null) sample.far = snap.far;
    if (snap.t_ms != null) sample.t_ms = snap.t_ms;
    if (snap.distance_m != null) sample.distance_m = snap.distance_m;
    if (any) out.push(sample);
  }
  return out;
}

export function preloadSamplesFromFrames(frames) {
  const out = [];
  for (const frame of frames || []) {
    const snap = (frame && frame.snap) || {};
    const sample = {};
    let any = false;
    if (snap.x != null) {
      sample.x = snap.x;
      any = true;
    }
    if (snap.z != null) {
      sample.z = snap.z;
      any = true;
    }
    if (snap.hdg != null) {
      sample.hdg = snap.hdg;
      any = true;
    }
    if (snap.spd != null) sample.spd = snap.spd;
    if (snap.vx != null) sample.vx = snap.vx;
    if (snap.vz != null) sample.vz = snap.vz;
    if (snap.t_ms != null) sample.t_ms = snap.t_ms;
    if (snap.cells) {
      sample.cells = snap.cells;
      any = true;
    }
    if (snap.streaming) {
      sample.streaming = snap.streaming;
      any = true;
    }
    if (any) out.push(sample);
  }
  return out;
}
