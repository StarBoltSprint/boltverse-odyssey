import assert from "node:assert/strict";
import test from "node:test";
import { createJudge } from "./checks.mjs";
import { normalizeLayout } from "./layout.mjs";

const layout = normalizeLayout({
  id: "t",
  zone: { center: [0, 0], radius_m: 20 },
  edge_ring: {
    radius_m: 18,
    hulls: [
      { id: "edge-0", heading_deg: 0, width_deg: 180 },
      { id: "edge-1", heading_deg: 180, width_deg: 180 },
    ],
  },
  gates: [{ id: "to-path", heading_deg: 90, width_m: 4 }],
  interior_objects: [],
  near_lens: { cull_m: 1.2 },
  fog_band: { patches: 32 },
  view: { mag_max: 1 },
  backdrop: { ring: "backdrop/ring.png" },
});

function ids(labelMap, w = 20, h = 20) {
  const labels = ["", ...Object.keys(labelMap)];
  const data = new Uint16Array(w * h);
  for (const [label, pixels] of Object.entries(labelMap)) {
    const idx = labels.indexOf(label);
    for (const p of pixels) data[p] = idx;
  }
  const bytes = Buffer.from(data.buffer);
  return { width: w, height: h, labels, b64: bytes.toString("base64") };
}

test("magnification above 1 fails even when the rest of the pose looks fine", () => {
  const judge = createJudge(layout);
  const rgba = new Uint8Array(32 * 32 * 4);
  rgba.fill(80);
  judge.add({
    id: "spawn",
    kind: "spawn",
    width: 32,
    height: 32,
    rgba,
    snap: {
      mag: 1.17,
      magSources: { ground: 1.17 },
      heroCount: 1,
      state: "IDLE",
      spd: 0,
      hdg: 0,
      x: 0,
      z: 0,
      canvas: { width: 720, height: 1600 },
      nearestVisibleM: 4,
      backdrop: { sourceW: 8192, sourceH: 1024, screenW: 720, screenH: 600, fovDeg: 40 },
      objectIds: ids({ hero: [10] }),
      gate: { id: "to-path", bearing_deg: 0, dist_m: 18 },
    },
  });
  const { rows } = judge.finish({ glErrors: [], consoleErrors: [] });
  const mag = rows.find((r) => r.id === "mag_max");
  assert.equal(mag.result, "FAIL");
  assert.ok(mag.numbers.mag_max > 1);
});

test("a webgl console error fails webgl_errors", () => {
  const judge = createJudge(layout);
  judge.add({
    id: "spawn",
    kind: "spawn",
    width: 8,
    height: 8,
    rgba: new Uint8Array(8 * 8 * 4),
    snap: {
      mag: 0.9,
      heroCount: 1,
      canvas: { width: 720, height: 1600 },
      nearestVisibleM: 3,
      objectIds: ids({}),
    },
  });
  const { rows } = judge.finish({
    glErrors: [],
    consoleErrors: ["[.WebGL] GL_INVALID_OPERATION: glTexSubImage3D: bad upload"],
  });
  assert.equal(rows.find((r) => r.id === "webgl_errors").result, "FAIL");
  assert.equal(rows.find((r) => r.id === "webgl_clean").result, "FAIL");
});

test("transition rows stay absent until snapshot().transition is present", () => {
  const judge = createJudge(layout);
  judge.add({
    id: "spawn",
    kind: "spawn",
    width: 8,
    height: 8,
    rgba: new Uint8Array(8 * 8 * 4),
    snap: {
      mag: 0.5,
      heroCount: 1,
      canvas: { width: 720, height: 1600 },
      nearestVisibleM: 4,
      objectIds: ids({}),
    },
  });
  const plain = judge.finish({ glErrors: [], consoleErrors: [] }).rows;
  assert.equal(plain.some((r) => r.id === "transition_black"), false);
  assert.equal(plain.some((r) => r.id === "transition_hitch"), false);

  const again = createJudge(layout);
  again.add({
    id: "handoff",
    kind: "spawn",
    width: 8,
    height: 8,
    rgba: new Uint8Array(8 * 8 * 4),
    snap: {
      mag: 0.5,
      heroCount: 1,
      canvas: { width: 720, height: 1600 },
      nearestVisibleM: 4,
      objectIds: ids({}),
      transition: { black: false, hitchMs: 16 },
    },
  });
  const passed = again.finish({ glErrors: [], consoleErrors: [] }).rows;
  assert.equal(passed.find((r) => r.id === "transition_black").result, "PASS");
  assert.equal(passed.find((r) => r.id === "transition_hitch").result, "PASS");

  const bad = createJudge(layout);
  bad.add({
    id: "handoff",
    kind: "spawn",
    width: 8,
    height: 8,
    rgba: new Uint8Array(8 * 8 * 4),
    snap: {
      mag: 0.5,
      heroCount: 1,
      canvas: { width: 720, height: 1600 },
      nearestVisibleM: 4,
      objectIds: ids({}),
      transition: { black: true, hitchMs: 180 },
    },
  });
  const failed = bad.finish({ glErrors: [], consoleErrors: [] }).rows;
  assert.equal(failed.find((r) => r.id === "transition_black").result, "FAIL");
  assert.equal(failed.find((r) => r.id === "transition_hitch").result, "FAIL");
  assert.equal(failed.find((r) => r.id === "transition_hitch").numbers.limitMs, 100);
});

test("ring data misses fail even if no pixels were required yet", () => {
  const open = normalizeLayout({
    id: "open",
    zone: { center: [0, 0], radius_m: 10 },
    edge_ring: { radius_m: 10, hulls: [{ id: "edge-0", heading_deg: 0, width_deg: 10 }] },
    gates: [],
    interior_objects: [],
    fog_band: { patches: 0 },
    view: { mag_max: 1 },
  });
  const judge = createJudge(open);
  const { rows } = judge.finish({ glErrors: [], consoleErrors: [] });
  const ring = rows.find((r) => r.id === "ring_closed");
  assert.equal(ring.result, "FAIL");
  assert.ok(ring.numbers.dataMissCount > 0);
});
