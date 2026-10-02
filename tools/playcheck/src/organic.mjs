/**
 * Organic zone walk (schema clearing/2). Invisible shape only.
 * Thresholds: owner decision 2026-10-02, spec rails 10 and 11.
 * PROBE_INSET_M is a start offset so the probe begins inside the footprint.
 * It is not a PASS/FAIL threshold.
 */

import { colorVisible, windowCountAny } from "./pixels.mjs";

export const BOUNDARY_SPACING_M = 10;
export const BOUNDARY_GAP_M = 0.5;
export const LANDMARK_FRAME_FRAC = 0.01;
export const LANDMARK_SAMPLE_FRAC = 0.6;
export const POP_MIN_PX = 3000;
export const POP_KEEP_FRAC = 0.2;
export const TRI_VISIBLE_MAX = 300000;
export const PROBE_INSET_M = 1.5;

const HIDDEN = "hidden_from_spawn";
const LANDMARK = "landmark";

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function row(id, result, numbers, detail, extra = {}) {
  return { id, result, numbers, detail, heuristic: !!extra.heuristic, partial: !!extra.partial };
}

export function openRing(footprint) {
  const pts = (footprint || []).map((p) => [num(p[0], 0), num(p[1], 0)]);
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) pts.pop();
  }
  return pts;
}

export function pointInPolygon(x, z, footprint) {
  const pts = openRing(footprint);
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0];
    const zi = pts[i][1];
    const xj = pts[j][0];
    const zj = pts[j][1];
    const cross = zi > z !== zj > z;
    if (cross && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i];
    const n = pts[(i + 1) % pts.length];
    a += c[0] * n[1] - n[0] * c[1];
  }
  return a / 2;
}

function ringSegments(pts) {
  const segs = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, len, s0: s });
    s += len;
  }
  return { segs, perim: s };
}

function pointAt(segs, s, perim) {
  let u = s % perim;
  if (u < 0) u += perim;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const end = seg.s0 + seg.len;
    const last = i === segs.length - 1;
    if (!last && u >= end - 1e-9) continue;
    const t = seg.len > 1e-9 ? Math.min(1, Math.max(0, (u - seg.s0) / seg.len)) : 0;
    const x = seg.a[0] + (seg.b[0] - seg.a[0]) * t;
    const z = seg.a[1] + (seg.b[1] - seg.a[1]) * t;
    const tx = (seg.b[0] - seg.a[0]) / (seg.len || 1);
    const tz = (seg.b[1] - seg.a[1]) / (seg.len || 1);
    return { x, z, tx, tz };
  }
  const seg = segs[0];
  return { x: seg.a[0], z: seg.a[1], tx: 1, tz: 0 };
}

function arcDist(a, b, perim) {
  const d = Math.abs(a - b);
  return Math.min(d, Math.abs(perim - d));
}

function projectAt(segs, perim, x, z) {
  let best = 0;
  let bestD = Infinity;
  const steps = Math.max(8, Math.ceil(perim));
  for (let i = 0; i <= steps; i++) {
    const s = (i / steps) * perim;
    const p = pointAt(segs, s, perim);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function strictlyInside(x, z, footprint) {
  if (!pointInPolygon(x, z, footprint)) return false;
  const e = 0.15;
  return (
    pointInPolygon(x + e, z, footprint) &&
    pointInPolygon(x - e, z, footprint) &&
    pointInPolygon(x, z + e, footprint) &&
    pointInPolygon(x, z - e, footprint)
  );
}

function inwardOrigin(x, z, nx, nz, footprint) {
  const insets = [PROBE_INSET_M, 1, 0.6, 0.3, 0.15, 0.05];
  for (const inset of insets) {
    const ox = x - nx * inset;
    const oz = z - nz * inset;
    if (strictlyInside(ox, oz, footprint)) return [ox, oz];
  }
  // A vertex can sit where the edge normal leaves the polygon, or lands on the
  // previous edge. Slide along the edge until the origin is clearly inside.
  for (const inset of [PROBE_INSET_M, 0.8, 0.4, 0.15]) {
    for (const along of [0.5, 1.2, 2.5, 4]) {
      for (const side of [1, -1]) {
        const ox = x - nx * inset + nz * side * along;
        const oz = z - nz * inset - nx * side * along;
        if (strictlyInside(ox, oz, footprint)) return [ox, oz];
      }
    }
  }
  return [x - nx * 0.05, z - nz * 0.05];
}

export function readOrganic(raw) {
  const zone = (raw && raw.zone) || {};
  const footprint = openRing(zone.footprint || []);
  const subAreas = (raw.sub_areas || []).map((a) => ({
    id: String(a.id),
    x: num(a.center && a.center[0], num(a.x, 0)),
    z: num(a.center && a.center[1], num(a.z, 0)),
    radius: num(a.radius_m, num(a.radius, 0)),
    role: a.role || "",
  }));
  const passages = (raw.passages || []).map((p) => ({
    id: String(p.id),
    from: String(p.from),
    to: String(p.to),
    width: num(p.width_m, num(p.width, 0)),
    points: (p.center || p.points || []).map((q) => [num(q[0], 0), num(q[1], 0)]),
  }));
  const pieces = ((raw.boundary && raw.boundary.pieces) || []).map((p) => ({
    id: String(p.id),
    x: num(p.position && p.position[0], 0),
    z: num(p.position && p.position[1], 0),
    radius: num(p.radius_m, 0),
    category: String(p.category || ""),
  }));
  const gates = (raw.gates || []).map((g) => ({
    id: String(g.id),
    at_m: Number.isFinite(Number(g.at_m)) ? Number(g.at_m) : null,
    width_m: num(g.width_m, 0),
    span_m: Number.isFinite(Number(g.span_m)) ? Number(g.span_m) : null,
    x: num(g.position && g.position[0], 0),
    z: num(g.position && g.position[1], 0),
    heading: num(g.heading_deg, 0),
  }));
  const pois = (raw.pois || []).map((p) => ({
    id: String(p.id),
    intent: String(p.intent || ""),
    x: num(p.position && p.position[0], 0),
    z: num(p.position && p.position[1], 0),
  }));
  const spawnPos = (raw.spawn && raw.spawn.position) || [0, 0];
  return {
    footprint,
    subAreas,
    passages,
    pieces,
    gates,
    pois,
    cells: raw.cells || null,
    always: raw.always || [],
    spawn: { x: num(spawnPos[0], 0), z: num(spawnPos[1], 0) },
  };
}

export function planBoundaryProbes(shape) {
  const pts = openRing(shape.footprint || []);
  if (pts.length < 3) return [];
  const { segs, perim } = ringSegments(pts);
  if (!(perim > 0)) return [];
  const area = signedArea(pts);
  const gates = (shape.gates || []).map((g) => {
    let at = g.at_m;
    if (!Number.isFinite(at)) at = projectAt(segs, perim, num(g.x, 0), num(g.z, 0));
    const span = g.span_m > 0 ? g.span_m : num(g.width_m, 0);
    return { at, half: span / 2 };
  });
  const probes = [];
  let i = 0;
  for (let s = 0; s < perim - 1e-6; s += BOUNDARY_SPACING_M) {
    const at = pointAt(segs, s, perim);
    let nx = at.tz;
    let nz = -at.tx;
    if (area < 0) {
      nx = -nx;
      nz = -nz;
    }
    const nlen = Math.hypot(nx, nz) || 1;
    nx /= nlen;
    nz /= nlen;
    const heading = (Math.atan2(nx, nz) * 180) / Math.PI;
    const headingDeg = (heading + 360) % 360;
    const origin = inwardOrigin(at.x, at.z, nx, nz, pts);
    const gate = gates.some((g) => arcDist(s, g.at, perim) <= BOUNDARY_SPACING_M / 2 + g.half + 1e-6);
    probes.push({
      id: `probe-${i}`,
      s_m: s,
      x: at.x,
      z: at.z,
      heading_deg: headingDeg,
      origin,
      gate,
    });
    i++;
  }
  return probes;
}

function resample(pts, step) {
  if (!pts.length) return [];
  if (pts.length === 1) return [pts[0].slice()];
  const out = [pts[0].slice()];
  let acc = 0;
  let prev = pts[0];
  for (let i = 1; i < pts.length; i++) {
    let a = prev;
    const b = pts[i];
    let seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (seg > 1e-9 && acc + seg >= step) {
      const t = (step - acc) / seg;
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(p);
      a = p;
      seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc = 0;
    }
    acc += seg;
    prev = b;
  }
  const end = pts[pts.length - 1];
  const last = out[out.length - 1];
  if (Math.hypot(last[0] - end[0], last[1] - end[1]) > 1e-6) out.push(end.slice());
  if (out.length === 2) {
    out.splice(1, 0, [(pts[0][0] + end[0]) / 2, (pts[0][1] + end[1]) / 2]);
  }
  return out;
}

function passagePoints(p, fromId) {
  const pts = (p.points || p.center || []).map((q) => [num(q[0], 0), num(q[1], 0)]);
  if (fromId && p.from !== fromId) return pts.reverse();
  return pts;
}

export function buildRoute(shape) {
  const areas = shape.subAreas || [];
  const passages = (shape.passages || []).map((p) => ({
    id: String(p.id),
    from: String(p.from),
    to: String(p.to),
    width: num(p.width, num(p.width_m, 0)),
    points: (p.points || p.center || []).map((q) => [num(q[0], 0), num(q[1], 0)]),
  }));
  const byId = new Map(areas.map((a) => [a.id, a]));
  const start = areas.find((a) => a.role === "spawn") || areas[0];
  const adj = new Map();
  for (const a of areas) adj.set(a.id, []);
  for (const p of passages) {
    if (!adj.has(p.from)) adj.set(p.from, []);
    if (!adj.has(p.to)) adj.set(p.to, []);
    adj.get(p.from).push({ passage: p, other: p.to });
    adj.get(p.to).push({ passage: p, other: p.from });
  }
  const unused = new Set(passages.map((p) => p.id));
  const seen = new Set();
  const waypoints = [];
  let seq = 0;
  const push = (w) => {
    waypoints.push({ id: `wp-${seq++}`, ...w });
  };
  function addSub(id) {
    const a = byId.get(id);
    if (!a) return;
    push({ kind: "sub_area", subArea: id, passage: null, x: a.x, z: a.z });
    seen.add(id);
  }
  function addPassage(p, fromId) {
    const pts = passagePoints(p, fromId);
    const samples = resample(pts, 8);
    let added = 0;
    const end = pts[pts.length - 1] || [0, 0];
    for (const s of samples) {
      const atStart = Math.hypot(s[0] - pts[0][0], s[1] - pts[0][1]) < 0.2;
      const atEnd = Math.hypot(s[0] - end[0], s[1] - end[1]) < 0.2;
      if (atStart || atEnd) continue;
      push({ kind: "passage", subArea: null, passage: p.id, x: s[0], z: s[1] });
      added++;
    }
    if (!added) {
      const mid = pts.length ? [(pts[0][0] + end[0]) / 2, (pts[0][1] + end[1]) / 2] : [0, 0];
      push({ kind: "passage", subArea: null, passage: p.id, x: mid[0], z: mid[1] });
    }
    unused.delete(p.id);
  }
  function unusedEdge(id) {
    return (adj.get(id) || []).find((e) => unused.has(e.passage.id)) || null;
  }
  function dfs(id) {
    if (!seen.has(id)) addSub(id);
    let edge = unusedEdge(id);
    while (edge) {
      addPassage(edge.passage, id);
      dfs(edge.other);
      edge = unusedEdge(id);
    }
  }
  function bfs(from, to) {
    if (from === to) return [];
    const q = [from];
    const prev = new Map([[from, null]]);
    while (q.length) {
      const id = q.shift();
      for (const e of adj.get(id) || []) {
        if (prev.has(e.other)) continue;
        prev.set(e.other, { id, e });
        if (e.other === to) {
          const path = [];
          let cur = to;
          while (cur !== from) {
            const step = prev.get(cur);
            path.push(step.e);
            cur = step.id;
          }
          path.reverse();
          return path;
        }
        q.push(e.other);
      }
    }
    return [];
  }
  let current = start ? start.id : null;
  if (current) dfs(current);
  let guard = 0;
  while (unused.size && guard++ < passages.length + 4) {
    let target = null;
    for (const id of seen) {
      if (unusedEdge(id)) {
        target = id;
        break;
      }
    }
    if (!target) {
      for (const id of adj.keys()) {
        if (unusedEdge(id)) {
          target = id;
          break;
        }
      }
    }
    if (!target || !current) break;
    if (target !== current) {
      for (const step of bfs(current, target)) {
        addPassage(step.passage, current);
        current = step.other;
        if (!seen.has(current)) addSub(current);
      }
    }
    dfs(target);
    current = target;
  }
  return { waypoints, start: start ? start.id : null };
}

export function pieceGap(pieces, x, z) {
  let best = Infinity;
  for (const p of pieces || []) {
    const d = Math.hypot(x - p.x, z - p.z);
    const g = Math.max(0, d - p.radius);
    if (g < best) best = g;
  }
  return best;
}

export function evaluateBoundary(records) {
  const list = records || [];
  const active = list.filter((r) => !r.gate);
  const skipped = list.length - active.length;
  let bad = 0;
  let worst = null;
  for (const rec of active) {
    const gap = Number(rec.gap_m);
    const finite = Number.isFinite(gap);
    const fail = rec.blocked !== true || !rec.visible || !finite || gap > BOUNDARY_GAP_M;
    if (fail) bad++;
    if (finite && (!worst || gap > worst.gap)) worst = { id: rec.id, gap };
  }
  const result = active.length > 0 && bad === 0 ? "PASS" : "FAIL";
  const numbers = {
    probes: active.length,
    skipped_gates: skipped,
    bad,
    tolerance_m: BOUNDARY_GAP_M,
    spacing_m: BOUNDARY_SPACING_M,
    worst_gap_m: worst ? worst.gap : null,
    worst_id: worst ? worst.id : null,
  };
  const detail =
    result === "PASS"
      ? `Each ${BOUNDARY_SPACING_M} m probe stops within ${BOUNDARY_GAP_M} m of a visible boundary piece. Gate openings are skipped. Owner decision 2026-10-02, spec rail 10.`
      : active.length
        ? `${bad} probe(s) missed a visible stop within ${BOUNDARY_GAP_M} m. An invisible stop is FAIL. Owner decision 2026-10-02, spec rail 10.`
        : "No boundary probe was walked. Unmeasured is not a PASS.";
  return row("boundary_visible", result, numbers, detail, { partial: true });
}

export function evaluateDiscovery(input) {
  const hidden = (input && input.hidden) || [];
  const landmarks = (input && input.landmarks) || [];
  let spawnPx = 0;
  let routePx = 0;
  for (const h of hidden) {
    spawnPx += num(h.spawnPx, 0);
    routePx += num(h.routePx, 0);
  }
  let worstFrac = landmarks.length ? 1 : 0;
  let worstId = landmarks[0] ? landmarks[0].id : null;
  for (const lm of landmarks) {
    const samples = lm.samples || [];
    const frac = samples.length ? samples.filter((s) => num(s.frac, 0) >= LANDMARK_FRAME_FRAC).length / samples.length : 0;
    if (frac < worstFrac) {
      worstFrac = frac;
      worstId = lm.id;
    }
  }
  const hiddenOk = hidden.length >= 2 && hidden.every((h) => num(h.spawnPx, 0) === 0 && num(h.routePx, 0) > 0);
  const landOk =
    landmarks.length > 0 &&
    landmarks.every((lm) => {
      const samples = lm.samples || [];
      if (!samples.length) return false;
      return samples.filter((s) => num(s.frac, 0) >= LANDMARK_FRAME_FRAC).length / samples.length >= LANDMARK_SAMPLE_FRAC;
    });
  const result = hiddenOk && landOk ? "PASS" : "FAIL";
  const numbers = {
    hidden: hidden.length,
    spawn_px: spawnPx,
    route_px: routePx,
    landmark_frac: worstFrac,
    frame_min: LANDMARK_FRAME_FRAC,
    sample_min: LANDMARK_SAMPLE_FRAC,
    landmark_id: worstId,
  };
  const detail =
    result === "PASS"
      ? `${hidden.length} hidden POIs have 0 spawn-sweep pixels and are reached on the route. Landmark coverage ${worstFrac} (min ${LANDMARK_SAMPLE_FRAC} of samples at ${LANDMARK_FRAME_FRAC} of the frame). Owner decision 2026-10-02, spec rail 10.`
      : `Hidden POIs must be absent at the spawn sweep and present later (need at least 2). Landmark must cover ${LANDMARK_FRAME_FRAC} of the frame on ${LANDMARK_SAMPLE_FRAC} of route samples. Owner decision 2026-10-02, spec rail 10.`;
  return row("discovery", result, numbers, detail);
}

export function evaluateNoPop(samples) {
  const list = samples || [];
  const base = { min_px: POP_MIN_PX, keep_frac: POP_KEEP_FRAC, samples: list.length };
  if (list.length < 2) {
    return row("no_pop", "FAIL", base, "Fewer than two area samples. Unmeasured is not a PASS. Owner decision 2026-10-02, spec rail 11.");
  }
  if (list.some((s) => !Array.isArray(s.frustum))) {
    return row(
      "no_pop",
      "FAIL",
      base,
      "n/a (page lacks field frustum). An in-frustum drop cannot be judged without the frustum list. Owner decision 2026-10-02, spec rail 11.",
    );
  }
  let worst = null;
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1].areas || {};
    const next = list[i].areas || {};
    for (const id of list[i].frustum) {
      const from = num(prev[id], 0);
      const to = num(next[id], 0);
      if (from > POP_MIN_PX && to < POP_KEEP_FRAC * from) {
        if (!worst || from > worst.from) worst = { id, from, to };
      }
    }
  }
  if (worst) {
    return row(
      "no_pop",
      "FAIL",
      { worst_id: worst.id, worst_from: worst.from, worst_to: worst.to, ...base },
      `${worst.id} dropped from ${worst.from} px to ${worst.to} px in one frame while still in the frustum. Owner decision 2026-10-02, spec rail 11.`,
    );
  }
  return row(
    "no_pop",
    "PASS",
    { worst_id: null, worst_from: null, worst_to: null, ...base },
    `No in-frustum object above ${POP_MIN_PX} px dropped below ${POP_KEEP_FRAC} of its area in one frame. Owner decision 2026-10-02, spec rail 11.`,
  );
}

function na(name) {
  return `n/a (page lacks field ${name})`;
}

function cellSource(snap) {
  if (!snap || typeof snap !== "object") return null;
  if (snap.cells && typeof snap.cells === "object") return snap.cells;
  if (snap.cellPerf && typeof snap.cellPerf === "object") return snap.cellPerf;
  return null;
}

function cellValue(src, name) {
  if (!src) return na(name);
  if (name === "lod0" || name === "lod1" || name === "lod2") {
    const lod = src.lod || src.lodCounts || null;
    const raw = lod && lod[name] != null ? lod[name] : src[name];
    return Number.isFinite(Number(raw)) ? Number(raw) : na(name);
  }
  const raw = src[name];
  return Number.isFinite(Number(raw)) ? Number(raw) : na(name);
}

function cellsStreaming(snap, declared) {
  if (declared === true) return true;
  if (declared && typeof declared === "object" && declared.streaming) return true;
  if (snap && snap.streaming) return true;
  const cells = snap && (snap.cells || snap.cellPerf);
  return !!(cells && typeof cells === "object" && cells.streaming === true);
}

export function evaluateCells(snap, declared) {
  const src = cellSource(snap);
  const names = ["resident", "total", "triVisible", "lod0", "lod1", "lod2", "cellLoad_ms_max", "texMB_peak"];
  const numbers = {};
  for (const name of names) numbers[name] = cellValue(src, name);
  const fmt = (v) => (typeof v === "number" ? String(v) : v);
  numbers.cellsLine = `resident=${fmt(numbers.resident)}/${fmt(numbers.total)} triVisible=${fmt(numbers.triVisible)} lod0=${fmt(numbers.lod0)} lod1=${fmt(numbers.lod1)} lod2=${fmt(numbers.lod2)} cellLoad_ms_max=${fmt(numbers.cellLoad_ms_max)} texMB_peak=${fmt(numbers.texMB_peak)}`;
  // Director decision 2026-10-02 15:04 (delegated owner approval).
  // Declared streaming fails a missing resident, total, triVisible, or cellLoad_ms_max.
  // lod counts and texMB_peak stay n/a and do not fail on their own.
  if (cellsStreaming(snap, declared)) {
    const required = ["resident", "total", "triVisible", "cellLoad_ms_max"];
    const missingReq = required.filter((name) => typeof numbers[name] !== "number");
    if (missingReq.length) {
      const detail = missingReq.map((name) => `missing field ${name}`).join("; ");
      return row("cells", "FAIL", numbers, detail, { partial: false });
    }
  }
  const missing = names.filter((name) => typeof numbers[name] === "string");
  const tri = numbers.triVisible;
  const fail = typeof tri === "number" && tri > TRI_VISIBLE_MAX;
  const detail = fail
    ? `triVisible ${tri} is over ${TRI_VISIBLE_MAX}. Owner decision 2026-10-02, spec rail 11.`
    : missing.length
      ? missing.map((name) => numbers[name]).join("; ")
      : `Cells: ${numbers.cellsLine}. triVisible at or under ${TRI_VISIBLE_MAX} passes. cellLoad_ms_max is reported only. Owner decision 2026-10-02, spec rail 11.`;
  return row("cells", fail ? "FAIL" : "PASS", numbers, detail, { partial: missing.length > 0 });
}

export function boundaryRecords(layout, frames) {
  const pieces = layout.pieces || [];
  const pieceIds = pieces.map((p) => p.id);
  return (layout.probes || []).map((probe) => {
    if (probe.gate) {
      return { id: probe.id, s_m: probe.s_m, gate: true, blocked: false, visible: false, gap_m: null };
    }
    const frame = (frames || []).find((f) => f.kind === "boundary" && f.snap && f.snap.probeId === probe.id);
    if (!frame) {
      return { id: probe.id, s_m: probe.s_m, gate: false, blocked: false, visible: false, gap_m: Number.POSITIVE_INFINITY };
    }
    const gap = pieceGap(pieces, num(frame.snap.x, 0), num(frame.snap.z, 0));
    const win = windowCountAny(frame.ids, pieceIds, 0.32, 0.28, 0.68, 0.62);
    let visible = win.n >= 12;
    if (visible && frame.rgba) {
      let best = null;
      let bestN = 0;
      for (const [label, n] of Object.entries(win.by)) {
        if (n > bestN) {
          best = label;
          bestN = n;
        }
      }
      if (best) visible = colorVisible(frame.rgba, frame.width, frame.height, frame.ids, best).visible;
      else visible = false;
    }
    return {
      id: probe.id,
      s_m: probe.s_m,
      gate: false,
      blocked: frame.snap.blocked === true,
      visible,
      gap_m: gap,
    };
  });
}

export function discoveryFromFrames(layout, frames) {
  const pois = layout.pois || [];
  const hidden = pois.filter((p) => p.intent === HIDDEN);
  const landmarks = pois.filter((p) => p.intent === LANDMARK);
  const spawnFrames = (frames || []).filter((f) => f.kind === "spawn" || f.kind === "sweep");
  const routeFrames = (frames || []).filter((f) => f.kind === "sub_area" || f.kind === "passage");
  const px = (list, id) => {
    let n = 0;
    for (const f of list) n += (f.counts && f.counts.get(id)) || 0;
    return n;
  };
  const frac = (frame, id) => {
    const ids = frame.ids;
    if (!ids || !ids.width || !ids.height) return 0;
    return ((frame.counts && frame.counts.get(id)) || 0) / (ids.width * ids.height);
  };
  return {
    hidden: hidden.map((h) => ({ id: h.id, spawnPx: px(spawnFrames, h.id), routePx: px(routeFrames, h.id) })),
    landmarks: landmarks.map((lm) => ({ id: lm.id, samples: routeFrames.map((f) => ({ frac: frac(f, lm.id) })) })),
  };
}
