/**
 * clearing.json → the object list the rendered view must show.
 * Keys stay generic. Asset paths are opaque strings.
 */

const GATE_LABEL = (id) => `gate:${id}`;

export function normalizeLayout(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("layout is not an object");
  }
  const zone = raw.zone || {};
  const center = Array.isArray(zone.center) ? zone.center : [0, 0];
  const edge = raw.edge_ring || {};
  const radius = num(edge.radius_m, num(zone.radius_m, 0));
  const gates = (raw.gates || []).map((g) => {
    const half = gateHalfDeg(g.width_m, radius);
    return {
      id: String(g.id),
      label: GATE_LABEL(g.id),
      heading: num(g.heading_deg, 0),
      widthM: num(g.width_m, 0),
      halfDeg: half,
      leadsTo: g.leads_to || "",
    };
  });
  const hulls = assignHulls(edge.hulls || [], gates, radius);
  const interiors = (raw.interior_objects || []).map((o, i) => ({
    id: o.id ? String(o.id) : `interior:${i}`,
    position: Array.isArray(o.position) ? [num(o.position[0], 0), num(o.position[1], 0)] : [0, 0],
    yaw: num(o.yaw_deg, 0),
    radius: num(o.radius_m, 0.7),
  }));
  return {
    id: raw.id || "clearing",
    center: [num(center[0], 0), num(center[1], 0)],
    zoneRadius: num(zone.radius_m, radius),
    edgeRadius: radius,
    maxGapDeg: num(edge.max_gap_deg, 0),
    hulls,
    gates,
    interiors,
    cullM: num(raw.near_lens && raw.near_lens.cull_m, 1.2),
    fogPatches: num(raw.fog_band && raw.fog_band.patches, 0),
    fogInner: num(raw.fog_band && raw.fog_band.inner_m, 0),
    fogOuter: num(raw.fog_band && raw.fog_band.outer_m, 0),
    magMax: num(raw.view && raw.view.mag_max, 1),
    viewW: num(raw.view && raw.view.width, 720),
    viewH: num(raw.view && raw.view.height, 1600),
    spawn: raw.spawn || { position: [0, 0] },
    hasBackdrop: !!(raw.backdrop && (raw.backdrop.ring || raw.backdrop.asset)),
  };
}

function num(v, d) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

export function gateHalfDeg(widthM, radiusM) {
  if (!(radiusM > 0) || !(widthM > 0)) return 0;
  return (Math.atan(widthM / 2 / radiusM) * 180) / Math.PI;
}

function assignHulls(list, gates, radius) {
  const explicit = list.map((h, i) => ({
    id: h.id ? String(h.id) : `edge:${i}`,
    heading: num(h.heading_deg, 0),
    width: Number.isFinite(Number(h.width_deg)) ? Number(h.width_deg) : null,
    asset: h.asset || "",
  }));
  if (explicit.every((h) => h.width != null)) {
    return explicit.map((h) => ({ ...h, width: h.width }));
  }
  // No angular width in the file: split the circle evenly, then punch out gate spans.
  // This derivation is only the data half. The rendered half still has to see pixels.
  const n = Math.max(explicit.length, 1);
  const step = 360 / n;
  return explicit.map((h, i) => ({
    ...h,
    heading: Number.isFinite(Number(list[i].heading_deg)) ? h.heading : i * step,
    width: h.width != null ? h.width : step,
    radius,
  }));
}

export function wrap360(a) {
  let x = a % 360;
  if (x < 0) x += 360;
  return x;
}

export function wrap180(a) {
  const x = wrap360(a);
  return x > 180 ? x - 360 : x;
}

export function angDist(a, b) {
  return Math.abs(wrap180(a - b));
}

export function inGateSpan(heading, gates) {
  return gates.some((g) => angDist(heading, g.heading) <= g.halfDeg + 0.05);
}

/** 360 rays at 1° from the centre. A miss outside a gate span fails the data half. */
export function ringRays(layout) {
  const misses = [];
  let hit = 0;
  let gateSkip = 0;
  for (let deg = 0; deg < 360; deg++) {
    if (inGateSpan(deg + 0.5, layout.gates) || inGateSpan(deg, layout.gates)) {
      gateSkip++;
      continue;
    }
    const covered = layout.hulls.some((h) => angDist(deg + 0.5, h.heading) <= h.width / 2 + 0.05);
    if (covered) hit++;
    else misses.push(deg);
  }
  return { hit, gateSkip, misses };
}

export function layoutLabels(layout) {
  return {
    hulls: layout.hulls.map((h) => h.id),
    gates: layout.gates.map((g) => g.label),
    interiors: layout.interiors.map((o) => o.id),
  };
}

export function isLayoutObject(label, layout) {
  if (!label) return false;
  const { hulls, gates, interiors } = layoutLabels(layout);
  return hulls.includes(label) || gates.includes(label) || interiors.includes(label) || layout.gates.some((g) => g.id === label);
}

export function surfaceGap(layout, x, z) {
  const dx = x - layout.center[0];
  const dz = z - layout.center[1];
  const dist = Math.hypot(dx, dz);
  let gap = Math.abs(layout.edgeRadius - dist);
  let which = "edge_ring";
  for (const o of layout.interiors) {
    const d = Math.hypot(x - o.position[0], z - o.position[1]);
    const g = Math.abs(d - o.radius);
    if (g < gap) {
      gap = g;
      which = o.id;
    }
  }
  return { dist, gap, which };
}
