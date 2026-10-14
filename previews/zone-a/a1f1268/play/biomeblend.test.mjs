// node --test packs/zone-a/play/biomeblend.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_POST, postOf, measurePath, createBiomeBlend, smoothstep } from "./biomeblend.js";

test("kit without post block = zone A defaults; out-of-range numbers clamp to light post", () => {
  const a = postOf({ id: "a" });
  for (const k of Object.keys(DEFAULT_POST)) assert.equal(a[k], DEFAULT_POST[k]);
  const hot = postOf({ id: "x", post: { fogCap: 0.95, saturation: 2, bloomGain: 1 } });
  assert.equal(hot.fogCap, 0.65);
  assert.equal(hot.saturation, 1.15);
  assert.equal(hot.bloomGain, 0.15);
});

test("path projection: distance along and lateral", () => {
  const p = measurePath([[0, 0], [0, 10], [10, 10]]);
  assert.equal(p.length, 20);
  const q = p.project(5, 12);
  assert.ok(Math.abs(q.s - 15) < 1e-9 && Math.abs(q.d - 2) < 1e-9);
});

test("blend is smooth, monotonic along the path and complete at the end", () => {
  const from = postOf({ id: "a" }, [0.2, 0.2, 0.3]);
  const to = postOf({ id: "b", post: { fogDensity: 0.02, gradeMix: 0.32 } }, [0.6, 0.4, 0.3]);
  let approach = 0;
  let arrive = 0;
  const b = createBiomeBlend({ from, to, path: [[0, 0], [0, 40]], startM: 10, endM: 30, onApproach: () => approach++, onArrive: () => arrive++ });
  let prev = -1;
  for (let z = 0; z <= 40; z += 0.5) {
    b.update(0, z);
    const t = b.info().t;
    assert.ok(t >= prev - 1e-12);
    assert.ok(t - prev < 0.08 || prev < 0, "no jump in the blend");
    prev = t;
  }
  assert.equal(prev, 1);
  const end = b.update(0, 40);
  assert.ok(Math.abs(end.fogDensity - 0.02) < 1e-12);
  assert.deepEqual(end.fog.map((v) => +v.toFixed(6)), [0.6, 0.4, 0.3]);
  assert.equal(approach, 1);
  assert.equal(arrive, 1);
});

test("missing target fog colour keeps the current biome's sampled fog (never a typed colour)", () => {
  const from = postOf({ id: "a" }, [0.2, 0.2, 0.3]);
  const to = postOf({ id: "b" }, null);
  const b = createBiomeBlend({ from, to, path: [[0, 0], [0, 10]] });
  assert.deepEqual(b.update(0, 10).fog, [0.2, 0.2, 0.3]);
});

test("a QC override never fires the zone hooks", () => {
  let n = 0;
  const b = createBiomeBlend({ from: postOf({ id: "a" }), to: postOf({ id: "b" }), path: [[0, 0], [0, 10]], onApproach: () => n++, onArrive: () => n++ });
  b.setOverride(1);
  b.update(0, 0);
  assert.equal(n, 0);
});

test("empty path (placeholder) = no blend; override drives QC frames", () => {
  const b = createBiomeBlend({ from: postOf({ id: "a" }), to: postOf({ id: "b", post: { fogCap: 0.62 } }), path: [] });
  assert.equal(b.update(0, 0).fogCap, DEFAULT_POST.fogCap);
  b.setOverride(1);
  assert.equal(b.update(0, 0).fogCap, 0.62);
  b.setOverride(null);
  assert.equal(b.update(0, 0).fogCap, DEFAULT_POST.fogCap);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
});
