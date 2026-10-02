import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createJudge } from "./checks.mjs";
import { normalizeLayout } from "./layout.mjs";
import {
  BOUNDARY_GAP_M,
  BOUNDARY_SPACING_M,
  LANDMARK_FRAME_FRAC,
  LANDMARK_SAMPLE_FRAC,
  POP_KEEP_FRAC,
  POP_MIN_PX,
  PROBE_INSET_M,
  TRI_VISIBLE_MAX,
  buildRoute,
  evaluateBoundary,
  evaluateCells,
  evaluateDiscovery,
  evaluateNoPop,
  planBoundaryProbes,
  pointInPolygon,
  readOrganic,
} from "./organic.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CELLS = {
  resident: 2,
  total: 4,
  triVisible: 12000,
  lod: { lod0: 3, lod1: 1, lod2: 2 },
  cellLoad_ms_max: 4,
  texMB_peak: 11,
};

test("organic thresholds stay on the spec rails", () => {
  assert.equal(BOUNDARY_SPACING_M, 10);
  assert.equal(BOUNDARY_GAP_M, 0.5);
  assert.equal(LANDMARK_FRAME_FRAC, 0.01);
  assert.equal(LANDMARK_SAMPLE_FRAC, 0.6);
  assert.equal(POP_MIN_PX, 3000);
  assert.equal(POP_KEEP_FRAC, 0.2);
  assert.equal(TRI_VISIBLE_MAX, 300000);
  assert.equal(PROBE_INSET_M, 1.5);
});

test("route walks every sub-area and every passage", () => {
  const route = buildRoute({
    subAreas: [
      { id: "sa-a", x: 0, z: 0, role: "spawn" },
      { id: "sa-b", x: 30, z: 0, role: "walk" },
      { id: "sa-c", x: 15, z: 20, role: "end" },
      { id: "sa-d", x: -12, z: 8, role: "spur" },
    ],
    passages: [
      { id: "p-ab", from: "sa-a", to: "sa-b", points: [[0, 0], [30, 0]] },
      { id: "p-bc", from: "sa-b", to: "sa-c", points: [[30, 0], [15, 20]] },
      { id: "p-ca", from: "sa-c", to: "sa-a", points: [[15, 20], [0, 0]] },
      { id: "p-ad", from: "sa-a", to: "sa-d", points: [[0, 0], [-6, 4], [-12, 8]] },
    ],
  });
  const subs = new Set(route.waypoints.filter((w) => w.kind === "sub_area").map((w) => w.subArea));
  const passages = new Set(route.waypoints.filter((w) => w.kind === "passage").map((w) => w.passage));
  for (const id of ["sa-a", "sa-b", "sa-c", "sa-d"]) assert.ok(subs.has(id), id);
  for (const id of ["p-ab", "p-bc", "p-ca", "p-ad"]) assert.ok(passages.has(id), id);
  assert.equal(route.waypoints[0].subArea, "sa-a");
});

test("boundary probes step every 10 m and face outward", () => {
  const footprint = [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ];
  const probes = planBoundaryProbes({
    footprint,
    gates: [{ id: "to-path", at_m: 20, width_m: 6 }],
  });
  assert.equal(probes.length, 14);
  assert.ok(probes.some((p) => p.gate));
  assert.equal(probes.filter((p) => p.gate).length, 1);
  const bottom = probes.find((p) => Math.abs(p.s_m - 10) < 1e-6);
  assert.ok(bottom);
  assert.ok(Math.abs(bottom.heading_deg - 180) < 1);
  assert.ok(Math.abs(bottom.origin[1] - PROBE_INSET_M) < 0.05);
  assert.equal(pointInPolygon(bottom.origin[0], bottom.origin[1], footprint), true);
  const right = probes.find((p) => Math.abs(p.s_m - 50) < 1e-6);
  assert.ok(Math.abs(right.heading_deg - 90) < 1);
  const gaps = [];
  for (let i = 1; i < probes.length; i++) gaps.push(probes[i].s_m - probes[i - 1].s_m);
  assert.ok(gaps.every((g) => Math.abs(g - 10) < 1e-6));
});

test("clockwise footprint still probes outward", () => {
  const footprint = [
    [0, 0],
    [0, 30],
    [40, 30],
    [40, 0],
  ];
  const probes = planBoundaryProbes({ footprint, gates: [] });
  const bottom = probes.find((p) => p.z < 0.2 && p.x > 5 && p.x < 35);
  assert.ok(bottom, "expected a probe on the low-z edge");
  assert.ok(Math.abs(bottom.heading_deg - 180) < 1);
  assert.equal(pointInPolygon(bottom.origin[0], bottom.origin[1], footprint), true);
});

test("boundary_visible fails an invisible stop and a stop past 0.5 m", () => {
  const invisible = evaluateBoundary([
    { id: "p0", s_m: 0, gate: false, blocked: true, visible: false, gap_m: 2.4 },
    { id: "p1", s_m: 10, gate: false, blocked: true, visible: true, gap_m: 0.3 },
  ]);
  assert.equal(invisible.id, "boundary_visible");
  assert.equal(invisible.result, "FAIL");
  assert.equal(invisible.numbers.bad, 1);
  assert.equal(invisible.numbers.tolerance_m, 0.5);
  const far = evaluateBoundary([
    { id: "p0", s_m: 0, gate: false, blocked: true, visible: true, gap_m: 0.51 },
  ]);
  assert.equal(far.result, "FAIL");
  const ok = evaluateBoundary([
    { id: "p0", s_m: 0, gate: true, blocked: false, visible: false, gap_m: 9 },
    { id: "p1", s_m: 10, gate: false, blocked: true, visible: true, gap_m: 0.5 },
  ]);
  assert.equal(ok.result, "PASS");
  assert.equal(ok.numbers.probes, 1);
  const none = evaluateBoundary([]);
  assert.equal(none.result, "FAIL");
});

test("discovery fails a hidden poi seen at spawn, a miss on the route, and a weak landmark", () => {
  const seen = evaluateDiscovery({
    hidden: [
      { id: "h1", spawnPx: 12, routePx: 40 },
      { id: "h2", spawnPx: 0, routePx: 30 },
    ],
    landmarks: [{ id: "mark", samples: [{ frac: 0.02 }, { frac: 0.02 }] }],
  });
  assert.equal(seen.id, "discovery");
  assert.equal(seen.result, "FAIL");
  assert.ok(seen.numbers.spawn_px > 0);
  const missed = evaluateDiscovery({
    hidden: [
      { id: "h1", spawnPx: 0, routePx: 0 },
      { id: "h2", spawnPx: 0, routePx: 20 },
    ],
    landmarks: [{ id: "mark", samples: [{ frac: 0.02 }, { frac: 0.02 }] }],
  });
  assert.equal(missed.result, "FAIL");
  const weak = evaluateDiscovery({
    hidden: [
      { id: "h1", spawnPx: 0, routePx: 10 },
      { id: "h2", spawnPx: 0, routePx: 10 },
    ],
    landmarks: [
      {
        id: "mark",
        samples: [{ frac: 0.02 }, { frac: 0.02 }, { frac: 0.001 }, { frac: 0.001 }, { frac: 0.001 }],
      },
    ],
  });
  assert.equal(weak.result, "FAIL");
  assert.ok(weak.numbers.landmark_frac < 0.6);
  assert.equal(weak.numbers.frame_min, 0.01);
  assert.equal(weak.numbers.sample_min, 0.6);
  const good = evaluateDiscovery({
    hidden: [
      { id: "h1", spawnPx: 0, routePx: 8 },
      { id: "h2", spawnPx: 0, routePx: 9 },
    ],
    landmarks: [{ id: "mark", samples: [{ frac: 0.02 }, { frac: 0.005 }, { frac: 0.03 }] }],
  });
  assert.equal(good.result, "PASS");
  assert.equal(good.numbers.hidden, 2);
  const one = evaluateDiscovery({
    hidden: [{ id: "h1", spawnPx: 0, routePx: 8 }],
    landmarks: [{ id: "mark", samples: [{ frac: 0.02 }] }],
  });
  assert.equal(one.result, "FAIL");
});

test("no_pop fails a large in-frustum drop and ignores a leave and a small object", () => {
  const pop = evaluateNoPop([
    { areas: { stone: 4000, hero: 400 }, frustum: ["stone", "hero"] },
    { areas: { stone: 700, hero: 400 }, frustum: ["stone", "hero"] },
  ]);
  assert.equal(pop.id, "no_pop");
  assert.equal(pop.result, "FAIL");
  assert.equal(pop.numbers.worst_id, "stone");
  assert.equal(pop.numbers.worst_from, 4000);
  assert.equal(pop.numbers.min_px, 3000);
  assert.equal(pop.numbers.keep_frac, 0.2);
  const left = evaluateNoPop([
    { areas: { stone: 4000 }, frustum: ["stone"] },
    { areas: { stone: 0 }, frustum: [] },
  ]);
  assert.equal(left.result, "PASS");
  const small = evaluateNoPop([
    { areas: { pebble: 2000 }, frustum: ["pebble"] },
    { areas: { pebble: 10 }, frustum: ["pebble"] },
  ]);
  assert.equal(small.result, "PASS");
  const steady = evaluateNoPop([
    { areas: { stone: 8000 }, frustum: ["stone"] },
    { areas: { stone: 7600 }, frustum: ["stone"] },
  ]);
  assert.equal(steady.result, "PASS");
  const blind = evaluateNoPop([{ areas: { stone: 9000 } }, { areas: { stone: 0 } }]);
  assert.equal(blind.result, "FAIL");
  assert.match(blind.detail, /n\/a \(page lacks field frustum\)/);
});

test("cells line prints n/a for a missing field and fails triVisible over 300000", () => {
  const missing = evaluateCells({});
  assert.equal(missing.id, "cells");
  assert.equal(missing.result, "PASS");
  assert.equal(missing.partial, true);
  assert.match(String(missing.numbers.triVisible), /n\/a \(page lacks field triVisible\)/);
  assert.match(String(missing.numbers.resident), /n\/a \(page lacks field resident\)/);
  assert.match(missing.detail, /n\/a \(page lacks field/);
  assert.equal(missing.numbers.triVisible === 0, false);
  const over = evaluateCells({
    cells: { resident: 1, total: 2, triVisible: 300001, lod: { lod0: 1, lod1: 0, lod2: 0 }, cellLoad_ms_max: 2, texMB_peak: 4 },
  });
  assert.equal(over.result, "FAIL");
  assert.equal(over.numbers.triVisible, 300001);
  const cap = evaluateCells({ cells: { ...CELLS, triVisible: 300000 } });
  assert.equal(cap.result, "PASS");
  assert.equal(cap.numbers.lod0, 3);
  assert.match(cap.numbers.cellsLine, /resident=2\/4/);
});

test("organic-good is walked as a route, not a ring", () => {
  // Director decision 2026-10-02 15:04 (delegated owner approval): the committed
  // organic sample no longer stores clearing.json. Build it at run time so this
  // route still walks the generated footprint (probes stay >= 50). The P8 fixture
  // file is a smaller page and is not this input.
  const dir = mkdtempSync(path.join(tmpdir(), "dr1-route-"));
  const out = path.join(dir, "clearing.json");
  const spec = path.join(repo, "tools/layout/sample/organic-good/spec.json");
  const code = [
    "import json, sys",
    "from pathlib import Path",
    `root = Path(${JSON.stringify(repo)})`,
    "sys.path.insert(0, str(root))",
    "from tools.layout.generate import build_clearing",
    "from tools.layout.model import load_json",
    `spec_path = Path(${JSON.stringify(spec)})`,
    "clearing = build_clearing(load_json(spec_path), [root, spec_path.parent])",
    `Path(${JSON.stringify(out)}).write_text(json.dumps(clearing), encoding="utf-8")`,
  ].join("\n");
  execFileSync("python3", ["-c", code], { cwd: repo });
  const raw = JSON.parse(readFileSync(out, "utf8"));
  const shape = readOrganic(raw);
  const route = buildRoute(shape);
  const subs = new Set(route.waypoints.filter((w) => w.kind === "sub_area").map((w) => w.subArea));
  const passages = new Set(route.waypoints.filter((w) => w.kind === "passage").map((w) => w.passage));
  for (const area of shape.subAreas) assert.ok(subs.has(area.id), area.id);
  for (const passage of shape.passages) assert.ok(passages.has(passage.id), passage.id);
  const probes = planBoundaryProbes(shape);
  assert.ok(probes.length >= 50);
  assert.ok(probes.some((p) => p.gate));
  const inside = probes.filter((p) => !p.gate && pointInPolygon(p.origin[0], p.origin[1], shape.footprint));
  assert.equal(inside.length, probes.filter((p) => !p.gate).length);
  const layout = normalizeLayout(raw);
  assert.equal(layout.organic, true);
  assert.equal(layout.hulls.length, 0);
  const judge = createJudge(layout);
  judge.add(baseSnap("spawn", "spawn", []));
  const ids = judge.finish({ glErrors: [], consoleErrors: [], popSamples: steadyPop() }).rows.map((r) => r.id);
  for (const id of ["boundary_visible", "discovery", "no_pop", "cells"]) assert.ok(ids.includes(id), id);
  for (const id of ["ring_closed", "stops_visible", "collider_eq_visual"]) assert.equal(ids.includes(id), false, id);
});

test("circle layout does not emit organic rows", () => {
  const layout = normalizeLayout({
    schema: "clearing/1",
    id: "round",
    zone: { shape: "circle", center: [0, 0], radius_m: 20 },
    edge_ring: {
      radius_m: 18,
      hulls: [
        { id: "edge-0", heading_deg: 0, width_deg: 180 },
        { id: "edge-1", heading_deg: 180, width_deg: 180 },
      ],
    },
    gates: [{ id: "to-path", heading_deg: 90, width_m: 4 }],
    interior_objects: [],
    fog_band: { patches: 24 },
    view: { mag_max: 1, width: 720, height: 1600 },
  });
  assert.equal(layout.organic, undefined);
  const judge = createJudge(layout);
  judge.add(baseSnap("spawn", "spawn", []));
  const ids = judge.finish({ glErrors: [], consoleErrors: [] }).rows.map((r) => r.id);
  assert.ok(ids.includes("ring_closed"));
  for (const id of ["boundary_visible", "discovery", "no_pop", "cells"]) assert.equal(ids.includes(id), false, id);
});

test("organic judge: passing capture passes the four rows; each break fails its named row", () => {
  const layout = normalizeLayout(miniRaw());
  assert.equal(layout.organic, true);
  const good = runCase(layout, {});
  assert.equal(row(good, "boundary_visible").result, "PASS");
  assert.equal(row(good, "discovery").result, "PASS");
  assert.equal(row(good, "no_pop").result, "PASS");
  assert.equal(row(good, "cells").result, "PASS");
  assert.equal(good.rows.find((r) => r.id === "ring_closed"), undefined);
  assert.ok(row(good, "discovery").numbers.landmark_frac >= 0.6);
  assert.equal(row(good, "discovery").numbers.spawn_px, 0);

  const revealed = runCase(layout, { revealHiddenAtSpawn: true });
  assert.equal(row(revealed, "discovery").result, "FAIL");
  assert.ok(row(revealed, "discovery").numbers.spawn_px > 0);
  assert.equal(row(revealed, "boundary_visible").result, "PASS");
  assert.equal(row(revealed, "no_pop").result, "PASS");

  const gap = runCase(layout, { invisibleAt: 10 });
  assert.equal(row(gap, "boundary_visible").result, "FAIL");
  assert.ok(row(gap, "boundary_visible").numbers.bad >= 1);
  assert.equal(row(gap, "discovery").result, "PASS");
  assert.equal(row(gap, "no_pop").result, "PASS");

  const pop = runCase(layout, { pop: true });
  assert.equal(row(pop, "no_pop").result, "FAIL");
  assert.equal(row(pop, "boundary_visible").result, "PASS");
  assert.equal(row(pop, "discovery").result, "PASS");
  console.log(
    [
      `PASS boundary_visible ${row(good, "boundary_visible").result} probes=${row(good, "boundary_visible").numbers.probes}`,
      `PASS discovery ${row(good, "discovery").result} landmark_frac=${row(good, "discovery").numbers.landmark_frac} spawn_px=${row(good, "discovery").numbers.spawn_px}`,
      `FAIL discovery/reveal ${row(revealed, "discovery").result} spawn_px=${row(revealed, "discovery").numbers.spawn_px}`,
      `FAIL boundary_visible/gap ${row(gap, "boundary_visible").result} bad=${row(gap, "boundary_visible").numbers.bad} worst_gap_m=${row(gap, "boundary_visible").numbers.worst_gap_m}`,
      `FAIL no_pop ${row(pop, "no_pop").result} worst_from=${row(pop, "no_pop").numbers.worst_from} worst_to=${row(pop, "no_pop").numbers.worst_to}`,
    ].join("\n"),
  );
});

function row(judged, id) {
  const found = judged.rows.find((r) => r.id === id);
  assert.ok(found, id);
  return found;
}

function steadyPop() {
  return [
    { areas: { stone: 8000 }, frustum: ["stone"] },
    { areas: { stone: 7800 }, frustum: ["stone"] },
  ];
}

function runCase(layout, opts) {
  const judge = createJudge(layout);
  for (const frame of caseFrames(layout, opts)) judge.add(frame);
  const pop = opts.pop
    ? [
        { areas: { stone: 8000, hero: 400 }, frustum: ["stone", "hero"] },
        { areas: { stone: 100, hero: 400 }, frustum: ["stone", "hero"] },
      ]
    : steadyPop();
  return judge.finish({ glErrors: [], consoleErrors: [], softwareGl: true, popSamples: pop });
}

function caseFrames(layout, opts) {
  const frames = [];
  const spawnPaints = opts.revealHiddenAtSpawn ? [block("poi-hide-a", 4, 4, 8, 1), block("poi-mark", 2, 4, 20, 1)] : [block("poi-mark", 2, 4, 20, 1)];
  frames.push(baseSnap("01-spawn", "spawn", spawnPaints, { x: 10, z: 15, hdg: 0 }));
  for (const hdg of [0, 90, 180, 270]) {
    frames.push(baseSnap(`sweep-${hdg}`, "sweep", opts.revealHiddenAtSpawn ? spawnPaints : [block("poi-mark", 2, 4, 20, 1)], { x: 10, z: 15, hdg }));
  }
  frames.push(baseSnap("wp-sa-a", "sub_area", [block("poi-mark", 2, 4, 20, 1)], { x: 10, z: 15, hdg: 90 }));
  frames.push(
    baseSnap("wp-sa-b", "sub_area", [block("poi-mark", 2, 4, 20, 1), block("poi-hide-a", 4, 4, 8, 1), block("poi-hide-b", 5, 4, 8, 1)], {
      x: 30,
      z: 15,
      hdg: 180,
    }),
  );
  frames.push(baseSnap("wp-sa-c", "sub_area", [block("poi-mark", 2, 4, 20, 1), block("poi-hide-b", 5, 4, 8, 1)], { x: 20, z: 8, hdg: 0 }));
  frames.push(baseSnap("pass-1", "passage", [block("poi-mark", 2, 4, 20, 1)], { x: 20, z: 15, hdg: 90 }));
  for (const probe of layout.probes) {
    if (probe.gate) continue;
    const bad = opts.invisibleAt != null && Math.abs(probe.s_m - opts.invisibleAt) < 1e-6;
    const piece = layout.pieces.reduce((best, p) => {
      const d = Math.hypot(p.x - probe.x, p.z - probe.z);
      return !best || d < best.d ? { p, d } : best;
    }, null);
    const vx = probe.origin[0] - probe.x;
    const vz = probe.origin[1] - probe.z;
    const vlen = Math.hypot(vx, vz) || 1;
    const dist = bad ? piece.p.radius + 3 : piece.p.radius + 0.3;
    const paints = bad ? [] : [block(piece.p.id, 16, 16, 4, 4)];
    frames.push(
      baseSnap(probe.id, "boundary", paints, {
        x: probe.x + (vx / vlen) * dist,
        z: probe.z + (vz / vlen) * dist,
        hdg: probe.heading_deg,
        blocked: true,
        probeId: probe.id,
      }),
    );
  }
  const gate = layout.gates[0];
  const hx = 10;
  const hz = 15;
  const dist = Math.hypot(gate.position[0] - hx, gate.position[1] - hz);
  const hdg = (Math.atan2(gate.position[0] - hx, gate.position[1] - hz) * 180) / Math.PI;
  frames.push(
    baseSnap("03-gate-start", "gate", [block(gate.label, 8, 14, 12, 1), block("poi-mark", 2, 4, 20, 1)], {
      x: hx,
      z: hz,
      hdg,
      gate: { id: gate.id, bearing_deg: 0, dist_m: dist },
      pathTrigger: false,
    }),
  );
  frames.push(
    baseSnap("03-gate-end", "gate", [block(gate.label, 8, 14, 12, 1), block("poi-mark", 2, 4, 20, 1)], {
      x: hx,
      z: hz,
      hdg,
      gate: { id: gate.id, bearing_deg: 0, dist_m: dist },
      pathTrigger: true,
    }),
  );
  frames.push(baseSnap("06-gallop", "gallop", [], { x: 12, z: 15, hdg: 90, state: "GALLOP", spd: 3 }));
  frames.push(baseSnap("07-idle", "idle", [], { x: 12, z: 15, hdg: 90, state: "IDLE", spd: 0 }));
  return frames;
}

function block(label, y, x, w, h) {
  const pixels = [];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) pixels.push(yy * 40 + xx);
  }
  return { label, pixels };
}

function baseSnap(id, kind, paints, extra = {}) {
  return {
    id,
    kind,
    width: 0,
    height: 0,
    rgba: null,
    snap: {
      x: 0,
      z: 0,
      hdg: 0,
      spd: 0,
      mag: 0.8,
      magSources: { ground: 0.8, backdrop: 0.4 },
      state: "IDLE",
      blocked: false,
      pathTrigger: false,
      heroCount: 1,
      harness: true,
      canvas: { width: 720, height: 1600 },
      nearestVisibleM: 4,
      backdrop: { sourceW: 8192, sourceH: 1024, screenW: 720, screenH: 400, fovDeg: 50 },
      gate: { id: "to-path", bearing_deg: 0, dist_m: 18 },
      cells: CELLS,
      objectIds: paintIds(paints),
      ...extra,
    },
  };
}

function paintIds(paints) {
  const w = 40;
  const h = 40;
  const labels = ["", "hero"];
  const data = new Uint16Array(w * h);
  data[0] = 1;
  data[1] = 1;
  data[w] = 1;
  data[w + 1] = 1;
  for (const p of paints) {
    let idx = labels.indexOf(p.label);
    if (idx < 0) {
      labels.push(p.label);
      idx = labels.length - 1;
    }
    for (const i of p.pixels) data[i] = idx;
  }
  return { width: w, height: h, labels, b64: Buffer.from(data.buffer).toString("base64") };
}

function miniRaw() {
  const footprint = [
    [0, 0],
    [40, 0],
    [40, 30],
    [0, 30],
  ];
  const pieces = [];
  let s = 0;
  let n = 0;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < len - 0.01; d += 2) {
      const at = s + d;
      const gateDist = Math.min(Math.abs(at - 20), 140 - Math.abs(at - 20));
      if (gateDist <= 3) continue;
      const t = d / len;
      pieces.push({
        id: `b-${n++}`,
        position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        radius_m: 1.2,
        category: `boundary-${Math.floor(n / 5)}`,
      });
    }
    s += len;
  }
  return {
    schema: "clearing/2",
    id: "organic-fixture",
    zone: { shape: "organic", center: [20, 15], footprint, reference_area_m2: 100 },
    boundary: { pieces },
    sub_areas: [
      { id: "sa-a", center: [10, 15], radius_m: 6, role: "spawn" },
      { id: "sa-b", center: [30, 15], radius_m: 6, role: "walk" },
      { id: "sa-c", center: [20, 8], radius_m: 5, role: "end" },
    ],
    passages: [
      { id: "p-ab", from: "sa-a", to: "sa-b", width_m: 4, center: [[10, 15], [30, 15]] },
      { id: "p-bc", from: "sa-b", to: "sa-c", width_m: 4, center: [[30, 15], [20, 8]] },
      { id: "p-ca", from: "sa-c", to: "sa-a", width_m: 4, center: [[20, 8], [10, 15]] },
    ],
    gates: [{ id: "to-path", heading_deg: 180, width_m: 6, at_m: 20, position: [20, 0], leads_to: "path-ab" }],
    pois: [
      { id: "poi-hide-a", intent: "hidden_from_spawn", position: [30, 16] },
      { id: "poi-hide-b", intent: "hidden_from_spawn", position: [20, 8] },
      { id: "poi-mark", intent: "landmark", position: [10, 22] },
    ],
    interior_objects: [],
    spawn: { position: [10, 15] },
    near_lens: { cull_m: 1.2 },
    fog_band: { patches: 24, inner_m: 4, outer_m: 18 },
    view: { mag_max: 1, width: 720, height: 1600 },
    backdrop: { asset: "backdrop/far.png" },
  };
}
