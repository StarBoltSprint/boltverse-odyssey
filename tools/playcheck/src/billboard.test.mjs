import assert from "node:assert/strict";
import test from "node:test";
import { cropMae, judgeOrbit } from "./billboard.mjs";
import { createJudge } from "./checks.mjs";
import { normalizeLayout } from "./layout.mjs";

function ids(label, pixels, w = 16, h = 16) {
  const labels = ["", label];
  const data = new Uint16Array(w * h);
  for (const p of pixels) data[p] = 1;
  return { width: w, height: h, labels, data };
}

function paint(w, h, fn) {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const block = [];
for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) block.push(y * 16 + x);

test("identical 5° crops fail and a changing crop passes", () => {
  const flat = paint(16, 16, () => [40, 80, 120]);
  const same = judgeOrbit([
    { rgba: flat, width: 16, height: 16, ids: ids("rock", block), snap: { hdg: 0 } },
    { rgba: flat, width: 16, height: 16, ids: ids("rock", block), snap: { hdg: 5 } },
    { rgba: flat, width: 16, height: 16, ids: ids("rock", block), snap: { hdg: 10 } },
  ]);
  assert.equal(same.identical > 0, true);
  assert.equal(same.ok, false);

  const turned = judgeOrbit([
    { rgba: paint(16, 16, (x) => [x * 10, 20, 20]), width: 16, height: 16, ids: ids("rock", block), snap: { hdg: 25 } },
    { rgba: paint(16, 16, (x) => [20, x * 10, 40]), width: 16, height: 16, ids: ids("rock", block), snap: { hdg: 30 } },
    { rgba: paint(16, 16, (x) => [20, 40, x * 12]), width: 16, height: 16, ids: ids("rock", block), snap: { hdg: 35 } },
  ]);
  assert.equal(turned.identical, 0);
  assert.equal(turned.ok, true);
  assert.ok(cropMae(turned.perObject[0] ? new Float32Array([0]) : new Float32Array([0]), new Float32Array([0])) === 0);
});

test("solids_world_locked fails a billboard and passes a changing orbit", () => {
  const layout = normalizeLayout({
    id: "t",
    zone: { center: [0, 0], radius_m: 20 },
    edge_ring: { radius_m: 18, hulls: [{ id: "rock", heading_deg: 0, width_deg: 40 }] },
    gates: [{ id: "to-path", heading_deg: 90, width_m: 4 }],
    interior_objects: [],
    fog_band: { patches: 24 },
    view: { mag_max: 1 },
  });
  const flat = paint(16, 16, () => [30, 30, 30]);
  const judge = createJudge(layout);
  for (const hdg of [0, 5, 10]) {
    judge.add({
      id: `orbit-${hdg}`,
      kind: "orbit",
      width: 16,
      height: 16,
      rgba: flat,
      snap: {
        hdg,
        mag: 0.5,
        heroCount: 1,
        canvas: { width: 720, height: 1600 },
        nearestVisibleM: 4,
        objectIds: {
          width: 16,
          height: 16,
          labels: ["", "rock"],
          b64: Buffer.from(ids("rock", block).data.buffer).toString("base64"),
        },
      },
    });
  }
  const failed = judge.finish({ glErrors: [], consoleErrors: [] }).rows.find((r) => r.id === "solids_world_locked");
  assert.equal(failed.result, "FAIL");
  assert.ok(failed.numbers.identical > 0);

  const again = createJudge(layout);
  const colors = [
    (x) => [x * 12, 10, 10],
    (x) => [10, x * 12, 10],
    (x) => [10, 10, x * 12],
  ];
  [0, 5, 10].forEach((hdg, i) => {
    again.add({
      id: `orbit-${hdg}`,
      kind: "orbit",
      width: 16,
      height: 16,
      rgba: paint(16, 16, colors[i]),
      snap: {
        hdg,
        mag: 0.5,
        heroCount: 1,
        canvas: { width: 720, height: 1600 },
        nearestVisibleM: 4,
        objectIds: {
          width: 16,
          height: 16,
          labels: ["", "rock"],
          b64: Buffer.from(ids("rock", block).data.buffer).toString("base64"),
        },
      },
    });
  });
  const passed = again.finish({ glErrors: [], consoleErrors: [] }).rows.find((r) => r.id === "solids_world_locked");
  assert.equal(passed.result, "PASS");
});

test("the measurement harness records the row and does not apply it", () => {
  const layout = normalizeLayout({
    id: "t",
    zone: { center: [0, 0], radius_m: 20 },
    edge_ring: { radius_m: 18, hulls: [{ id: "rock", heading_deg: 0, width_deg: 40 }] },
    gates: [],
    interior_objects: [],
    fog_band: { patches: 24 },
    view: { mag_max: 1 },
  });
  const judge = createJudge(layout);
  const flat = paint(16, 16, () => [8, 8, 8]);
  for (const hdg of [0, 5]) {
    judge.add({
      id: `orbit-${hdg}`,
      kind: "orbit",
      width: 16,
      height: 16,
      rgba: flat,
      snap: {
        hdg,
        harness: true,
        mag: 0.5,
        heroCount: 1,
        canvas: { width: 720, height: 1600 },
        nearestVisibleM: 4,
        objectIds: {
          width: 16,
          height: 16,
          labels: ["", "rock"],
          b64: Buffer.from(ids("rock", block).data.buffer).toString("base64"),
        },
      },
    });
  }
  const row = judge.finish({ glErrors: [], consoleErrors: [] }).rows.find((r) => r.id === "solids_world_locked");
  assert.equal(row.result, "PASS");
  assert.equal(row.partial, true);
  assert.equal(row.numbers.applied, false);
  assert.ok(row.numbers.identical > 0);
});
