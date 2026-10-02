/**
 * TEST FIXTURE - not Imagine.
 * Synthetic captures for fade-in and preload-ahead. No play-view pixels.
 * Owner decree #457, approved 2026-10-02. Jump limit is the 20% figure of spec rail 11.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { createJudge } from "./checks.mjs";
import { normalizeLayout } from "./layout.mjs";
import { evaluateCells } from "./organic.mjs";

const streamingUrl = new URL("./streaming.mjs", import.meta.url);
const streaming = existsSync(streamingUrl) ? await import("./streaming.mjs") : {};

const STREAM = {
  fade_in_ms: 450,
  fade_in_distance_m: 16,
  preload_lookahead_m: 48,
  preload_cone_deg: 90,
};

const CELLS = [
  { id: "A", aabb: [[-12, 0], [12, 10]], members: [], neighbours: ["B"] },
  { id: "B", aabb: [[-12, 12], [12, 24]], members: [], neighbours: ["A"] },
];

function need(name) {
  const fn = streaming[name];
  assert.equal(typeof fn, "function", `${name} is absent; the row is not implemented`);
  return fn;
}

function rampSamples() {
  const n = 9;
  const samples = [];
  for (let i = 0; i <= n; i++) {
    samples.push({
      t_ms: (450 / n) * i,
      opacity: { "obj-a": i / n },
      representation: { "obj-a": i === 0 ? "none" : "full" },
      frustum: ["obj-a"],
    });
  }
  return samples;
}

function popSamples() {
  return [
    { t_ms: 0, opacity: { "obj-a": 0 }, representation: { "obj-a": "none" }, frustum: ["obj-a"] },
    { t_ms: 16, opacity: { "obj-a": 1 }, representation: { "obj-a": "full" }, frustum: ["obj-a"] },
  ];
}

function vanishSamples() {
  const samples = [
    { t_ms: 0, opacity: { "obj-a": 1 }, representation: { "obj-a": "far" }, frustum: ["obj-a"] },
    { t_ms: 50, opacity: { "obj-a": 0 }, representation: { "obj-a": "none" }, frustum: ["obj-a"] },
  ];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    samples.push({
      t_ms: 50 + (450 / n) * i,
      opacity: { "obj-a": i / n },
      representation: { "obj-a": i === 0 ? "none" : "full" },
      frustum: ["obj-a"],
    });
  }
  return samples;
}

function pose(t, z, ids) {
  return { t_ms: t, x: 0, z, hdg: 0, spd: 6, cells: { residentIds: ids.slice() } };
}

function earlySamples() {
  return [pose(0, 5, ["A"]), pose(100, 15, ["A", "B"])];
}

function aheadSamples() {
  return [pose(0, 5, ["A", "B"]), pose(100, 15, ["A", "B"])];
}

function streamLayout() {
  return {
    schema: "clearing/2",
    id: "stream-fixture",
    note: "TEST FIXTURE - not Imagine",
    zone: {
      shape: "organic",
      center: [0, 12],
      footprint: [[-12, 0], [12, 0], [12, 24], [-12, 24]],
      reference_area_m2: 100,
    },
    streaming: STREAM,
    cells: CELLS,
    boundary: { pieces: [] },
    sub_areas: [
      { id: "sa-a", center: [0, 5], radius_m: 4, role: "spawn" },
      { id: "sa-b", center: [0, 18], radius_m: 4, role: "walk" },
      { id: "sa-c", center: [0, 12], radius_m: 3, role: "end" },
    ],
    passages: [
      { id: "p-ab", from: "sa-a", to: "sa-b", width_m: 4, center: [[0, 5], [0, 18]] },
      { id: "p-bc", from: "sa-b", to: "sa-c", width_m: 4, center: [[0, 18], [0, 12]] },
      { id: "p-ca", from: "sa-c", to: "sa-a", width_m: 4, center: [[0, 12], [0, 5]] },
    ],
    gates: [{ id: "to-path", heading_deg: 0, width_m: 4, position: [0, 24], leads_to: "path-ab" }],
    pois: [],
    interior_objects: [],
  };
}

function spawnFrame() {
  const data = new Uint16Array(4);
  data[0] = 1;
  return {
    id: "spawn",
    kind: "spawn",
    width: 0,
    height: 0,
    rgba: null,
    snap: {
      x: 0,
      z: 5,
      hdg: 0,
      spd: 0,
      mag: 0.8,
      state: "IDLE",
      heroCount: 1,
      harness: true,
      canvas: { width: 720, height: 1600 },
      objectIds: { width: 2, height: 2, labels: ["", "hero"], b64: Buffer.from(data.buffer).toString("base64") },
      cells: { resident: 1, total: 2, triVisible: 10, lod0: 1, lod1: 0, lod2: 0, cellLoad_ms_max: 1, texMB_peak: 1 },
    },
  };
}

test("fade_in fails an object that pops from 0 to 100 percent in one frame", () => {
  const row = need("evaluateFadeIn")(popSamples(), STREAM);
  assert.equal(row.id, "fade_in");
  assert.equal(row.result, "FAIL");
  assert.ok(row.numbers.worst_jump > 0.2);
  assert.equal(row.numbers.count, 1);
  console.log(`FAIL fade_in pop result=${row.result} worst_jump=${row.numbers.worst_jump} worst_ramp_ms=${row.numbers.worst_ramp_ms}`);
});

test("fade_in passes a 450 ms monotonic ramp", () => {
  const row = need("evaluateFadeIn")(rampSamples(), STREAM);
  assert.equal(row.id, "fade_in");
  assert.equal(row.result, "PASS");
  assert.equal(row.numbers.count, 1);
  assert.equal(row.numbers.worst_ramp_ms, 450);
  assert.ok(row.numbers.worst_jump <= 0.2);
  console.log(`PASS fade_in ramp result=${row.result} count=${row.numbers.count} worst_ramp_ms=${row.numbers.worst_ramp_ms} worst_jump=${row.numbers.worst_jump}`);
});

test("fade_in fails a far representation that vanishes before the fade", () => {
  const row = need("evaluateFadeIn")(vanishSamples(), STREAM);
  assert.equal(row.id, "fade_in");
  assert.equal(row.result, "FAIL");
  assert.ok(row.numbers.vanished >= 1);
  console.log(`FAIL fade_in vanish result=${row.result} vanished=${row.numbers.vanished} worst_id=${row.numbers.worst_id}`);
});

test("preload_ahead fails a cell entered before it was resident", () => {
  const predict = need("predictHeadingPath");
  const path = predict({ x: 0, z: 5, hdg: 0 }, 48);
  assert.ok(path.points.length >= 1);
  assert.ok(Math.abs(path.points[path.points.length - 1].z - 53) < 1e-6);
  const row = need("evaluatePreloadAhead")(earlySamples(), { streaming: STREAM, cells: CELLS });
  assert.equal(row.id, "preload_ahead");
  assert.equal(row.result, "FAIL");
  assert.ok(row.numbers.misses >= 1);
  const ids = row.numbers.miss_ids || [];
  assert.ok(ids.includes("B"), ids.join(","));
  console.log(`FAIL preload_ahead early result=${row.result} misses=${row.numbers.misses} worst_lead_ms=${row.numbers.worst_lead_ms}`);
});

test("preload_ahead passes a cell that is resident at least one frame ahead", () => {
  const row = need("evaluatePreloadAhead")(aheadSamples(), { streaming: STREAM, cells: CELLS });
  assert.equal(row.id, "preload_ahead");
  assert.equal(row.result, "PASS");
  assert.equal(row.numbers.misses, 0);
  assert.equal(row.numbers.worst_lead_ms, 100);
  console.log(`PASS preload_ahead lead result=${row.result} misses=${row.numbers.misses} worst_lead_ms=${row.numbers.worst_lead_ms}`);
});

test("declared streaming missing residentIds fails", () => {
  // Expected value updated. Director decision 2026-10-02 15:04 (delegated owner approval):
  // a layout streaming block makes a missing residentIds field FAIL, not n/a.
  const row = need("evaluatePreloadAhead")(
    [{ t_ms: 0, x: 0, z: 5, hdg: 0, cells: { resident: 1, total: 2 } }],
    { streaming: STREAM, cells: CELLS },
  );
  assert.equal(row.result, "FAIL");
  assert.match(row.detail, /missing field residentIds/);
  assert.equal(String(row.numbers.residentIds).includes("n/a"), false);
});

test("missing resident ids stay n/a when streaming is not declared", () => {
  const row = need("evaluatePreloadAhead")(
    [{ t_ms: 0, x: 0, z: 5, hdg: 0, cells: { resident: 1, total: 2 } }],
    { cells: CELLS },
  );
  assert.equal(row.result, "PASS");
  assert.match(String(row.detail), /n\/a/);
  const cells = evaluateCells({});
  assert.equal(cells.result, "PASS");
  assert.equal(cells.partial, true);
  assert.match(String(cells.numbers.resident), /n\/a \(page lacks field resident\)/);
});

test("page streaming flag missing residentIds fails", () => {
  const row = need("evaluatePreloadAhead")(
    [{ t_ms: 0, x: 0, z: 5, hdg: 0, streaming: true, cells: { resident: 1, total: 2 } }],
    { cells: CELLS },
  );
  assert.equal(row.result, "FAIL");
  assert.match(row.detail, /missing field residentIds/);
  const nested = need("evaluatePreloadAhead")(
    [{ t_ms: 0, x: 0, z: 5, hdg: 0, cells: { streaming: true, resident: 1 } }],
    { cells: CELLS },
  );
  assert.equal(nested.result, "FAIL");
  assert.match(nested.detail, /missing field residentIds/);
});

test("declared streaming cells missing resident fails", () => {
  // Director decision 2026-10-02 15:04 (delegated owner approval).
  const row = evaluateCells({ streaming: true });
  assert.equal(row.id, "cells");
  assert.equal(row.result, "FAIL");
  assert.equal(row.partial, false);
  assert.match(row.detail, /missing field resident/);
  const viaArg = evaluateCells({}, { streaming: true });
  assert.equal(viaArg.result, "FAIL");
  assert.match(viaArg.detail, /missing field resident/);
  const lodOnly = evaluateCells({
    streaming: true,
    cells: { resident: 1, total: 2, triVisible: 10, cellLoad_ms_max: 4 },
  });
  assert.equal(lodOnly.result, "PASS");
  assert.match(String(lodOnly.numbers.lod0), /n\/a/);
  assert.match(String(lodOnly.numbers.texMB_peak), /n\/a/);
});

function crossfadeSamples() {
  const n = 9;
  const samples = [];
  for (let i = 0; i <= n; i++) {
    samples.push({
      t_ms: (450 / n) * i,
      opacity: { "obj-a": 0.4 + (0.6 * i) / n },
      representation: { "obj-a": i === n ? "full" : "far" },
      frustum: ["obj-a"],
    });
  }
  return samples;
}

test("fade_in passes a far representation that crossfades and never vanishes", () => {
  // The rule (Director decision 2026-10-02 15:04, delegated owner approval):
  // a fade from alpha 0 applies only to an object that was not on screen before
  // it entered range. An object already visible as its far version crossfades.
  const row = need("evaluateFadeIn")(crossfadeSamples(), STREAM);
  assert.equal(row.id, "fade_in");
  assert.equal(row.result, "PASS");
  assert.equal(row.numbers.vanished, 0);
  assert.equal(row.numbers.count, 1);
  console.log(`PASS fade_in crossfade result=${row.result} vanished=${row.numbers.vanished} worst_ramp_ms=${row.numbers.worst_ramp_ms}`);
});

test("judge fails cells and preload_ahead when the page declares streaming", () => {
  const organic = normalizeLayout({
    schema: "clearing/2",
    id: "page-stream",
    note: "TEST FIXTURE - not Imagine",
    zone: { shape: "organic", center: [5, 5], footprint: [[0, 0], [10, 0], [10, 10]] },
    gates: [],
    interior_objects: [],
  });
  const frame = spawnFrame();
  frame.snap.streaming = true;
  frame.snap.cells = { streaming: true };
  const judge = createJudge(organic);
  judge.add(frame);
  const judged = judge.finish({
    glErrors: [],
    consoleErrors: [],
    softwareGl: true,
    popSamples: [
      { areas: { hero: 400 }, frustum: ["hero"] },
      { areas: { hero: 400 }, frustum: ["hero"] },
    ],
  });
  const cells = judged.rows.find((r) => r.id === "cells");
  const pre = judged.rows.find((r) => r.id === "preload_ahead");
  const fade = judged.rows.find((r) => r.id === "fade_in");
  assert.ok(cells, "cells row is absent");
  assert.equal(cells.result, "FAIL");
  assert.match(cells.detail, /missing field resident/);
  assert.ok(pre, "preload_ahead row is absent");
  assert.equal(pre.result, "FAIL");
  assert.match(pre.detail, /missing field residentIds/);
  assert.equal(fade, undefined);
});

test("judge emits fade_in and preload_ahead for a streaming layout", () => {
  const layout = normalizeLayout(streamLayout());
  assert.equal(layout.organic, true);
  const judge = createJudge(layout);
  judge.add(spawnFrame());
  const judged = judge.finish({
    glErrors: [],
    consoleErrors: [],
    softwareGl: true,
    popSamples: [
      { areas: { hero: 400 }, frustum: ["hero"] },
      { areas: { hero: 400 }, frustum: ["hero"] },
    ],
    fadeSamples: popSamples(),
    preloadSamples: earlySamples(),
  });
  const fade = judged.rows.find((r) => r.id === "fade_in");
  const pre = judged.rows.find((r) => r.id === "preload_ahead");
  assert.ok(fade, "fade_in row is absent");
  assert.equal(fade.result, "FAIL");
  assert.ok(pre, "preload_ahead row is absent");
  assert.equal(pre.result, "FAIL");
  console.log(`FAIL judge fade_in=${fade.result} preload_ahead=${pre.result}`);
});

test("circle layout and organic layout without streaming omit the new rows", () => {
  const circle = normalizeLayout({
    schema: "clearing/1",
    id: "round",
    zone: { shape: "circle", center: [0, 0], radius_m: 20 },
    streaming: STREAM,
    edge_ring: { radius_m: 18, hulls: [{ id: "edge-0", heading_deg: 0, width_deg: 360 }] },
    gates: [{ id: "to-path", heading_deg: 90, width_m: 4 }],
    interior_objects: [],
    fog_band: { patches: 24 },
    view: { mag_max: 1, width: 720, height: 1600 },
  });
  assert.equal(circle.organic, undefined);
  const circleIds = createJudge(circle).finish({ glErrors: [], consoleErrors: [] }).rows.map((r) => r.id);
  assert.equal(circleIds.includes("fade_in"), false);
  assert.equal(circleIds.includes("preload_ahead"), false);
  const organic = normalizeLayout({
    schema: "clearing/2",
    id: "plain-organic",
    zone: { shape: "organic", center: [5, 5], footprint: [[0, 0], [10, 0], [10, 10]] },
    gates: [],
    interior_objects: [],
  });
  assert.equal(organic.streaming, undefined);
  const organicIds = createJudge(organic).finish({
    glErrors: [],
    consoleErrors: [],
    popSamples: [
      { areas: { hero: 10 }, frustum: ["hero"] },
      { areas: { hero: 10 }, frustum: ["hero"] },
    ],
  }).rows.map((r) => r.id);
  assert.equal(organicIds.includes("fade_in"), false);
  assert.equal(organicIds.includes("preload_ahead"), false);
  assert.equal(organicIds.includes("no_pop"), true);
});
