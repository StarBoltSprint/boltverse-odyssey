/**
 * Zone-placed library colliders and the approach-run log.
 * Bad collision, float, missing clearance, a tight lintel, and a keep-out all FAIL.
 * The good fixture passes. A broken log line fails the schema.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluatePlacement, parseApproachLog, readPlacement, validateApproachRecord } from "./approach.mjs";
import { normalizeLayout } from "./layout.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const good = JSON.parse(readFileSync(path.join(here, "../fixture/approach/good.json"), "utf8"));

function row(run, id) {
  return run.rows.find((item) => item.id === id);
}

test("good zone placement passes collision, ground, clearance, and the approach log", () => {
  const run = evaluatePlacement(good);
  assert.equal(run.result, "PASS");
  assert.deepEqual(run.flags, []);
  assert.equal(row(run, "part_colliders").result, "PASS");
  assert.equal(row(run, "ground_anchor").result, "PASS");
  assert.equal(row(run, "hanging_clearance").result, "PASS");
  assert.equal(row(run, "approach_log").result, "PASS");
  const left = run.boxes.find((box) => box.id === "jamb-l");
  assert.equal(left.min[1], 0);
  assert.ok(Math.abs(left.min[0] - 4.7) < 1e-9);
  assert.ok(Math.abs(left.min[2] - -2) < 1e-9);
  assert.equal(run.records.length, 21);
  assert.ok(run.records.every((record) => record.collision === "miss"));
  assert.ok(run.records.every((record) => record.facing === 90));
  const mid = run.records.find((record) => Math.abs(record.position[0] - 5) < 1e-9);
  assert.equal(mid.nearestPartId, "gate-arch");
  assert.ok(Math.abs(mid.distance - 1.2) < 1e-6);
  assert.equal(mid.cameraLayer, "near");
  assert.equal(mid.fps, 30);
  assert.equal(mid.position[1], 0);
  assert.equal(mid.schema, "approach-run/1");
  const parsed = parseApproachLog(run.jsonl);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.records.length, 21);
  const layout = normalizeLayout(good);
  assert.equal(layout.placement.id, "approach-good");
});

test("a yawed scaled box lands on the ground anchor", () => {
  const run = evaluatePlacement({
    schema: "zone-placement/1",
    ground_y: 0,
    path: { width_m: 2, min_clearance_m: 2, points: [[0, 0], [1, 0]] },
    library: {
      slab: {
        id: "slab",
        ground_anchor: [0, 0, 0],
        boxes: [{ id: "b", min: [-1, 0, -1], max: [1, 2, 1], role: "solid" }],
      },
    },
    parts: [{ id: "p", library: "slab", position: [10, 3, 4], yaw_deg: 90, scale: 2, ground_snap: true }],
  });
  assert.equal(run.result, "PASS");
  const box = run.boxes[0];
  assert.ok(Math.abs(box.min[0] - 8) < 1e-6);
  assert.ok(Math.abs(box.max[0] - 12) < 1e-6);
  assert.ok(Math.abs(box.min[1] - 0) < 1e-6);
  assert.ok(Math.abs(box.max[1] - 4) < 1e-6);
  assert.ok(Math.abs(box.min[2] - 2) < 1e-6);
  assert.ok(Math.abs(box.max[2] - 6) < 1e-6);
});

test("camera layer follows distance: mid under 64 m, far at 64 m and beyond", () => {
  function place(z) {
    return evaluatePlacement({
      schema: "zone-placement/1",
      ground_y: 0,
      path: { width_m: 2, min_clearance_m: 2, points: [[0, 0], [1, 0]] },
      library: {
        post: {
          id: "post",
          ground_anchor: [0, 0, 0],
          boxes: [{ id: "b", min: [-0.2, 0, -0.2], max: [0.2, 1, 0.2], role: "solid" }],
        },
      },
      parts: [{ id: "post-1", library: "post", position: [0, 0, z], yaw_deg: 0, scale: 1, ground_snap: true }],
    });
  }
  assert.equal(place(30).records[0].cameraLayer, "mid");
  assert.equal(place(80).records[0].cameraLayer, "far");
  assert.equal(place(80).result, "PASS");
});

test("a world box that is not the transformed library box fails", () => {
  const zone = structuredClone(good);
  zone.parts[0].world_boxes = [{ min: [4, 0, -0.3], max: [4.8, 3, 0.3] }];
  const run = evaluatePlacement(zone);
  assert.equal(run.result, "FAIL");
  assert.ok(run.flags.includes("bad_collision"));
  assert.equal(row(run, "part_colliders").result, "FAIL");
  assert.equal(row(run, "ground_anchor").result, "PASS");
  assert.equal(row(run, "hanging_clearance").result, "PASS");
  assert.equal(row(run, "approach_log").result, "PASS");

  const broken = structuredClone(good);
  broken.library.arch.boxes.push({ id: "twist", min: [1, 0, 0], max: [0, 1, 1], role: "solid" });
  const degenerated = evaluatePlacement(broken);
  assert.equal(degenerated.result, "FAIL");
  assert.ok(degenerated.flags.includes("bad_collision"));
});

test("a floating ground anchor fails", () => {
  const floated = structuredClone(good);
  floated.parts[0].ground_snap = false;
  floated.parts[0].position = [5, 1.5, 0];
  const run = evaluatePlacement(floated);
  assert.equal(run.result, "FAIL");
  assert.ok(run.flags.includes("float"));
  assert.equal(row(run, "ground_anchor").result, "FAIL");
  assert.equal(row(run, "part_colliders").result, "PASS");
  assert.equal(row(run, "hanging_clearance").result, "PASS");
  assert.equal(row(run, "approach_log").result, "PASS");

  const missing = structuredClone(good);
  delete missing.library.arch.ground_anchor;
  const missed = evaluatePlacement(missing);
  assert.ok(missed.flags.includes("float"));
  assert.equal(row(missed, "ground_anchor").result, "FAIL");
});

test("hanging detail with no clearance box fails", () => {
  const zone = structuredClone(good);
  zone.library.arch.hanging = true;
  zone.library.arch.boxes = zone.library.arch.boxes.filter((box) => box.role !== "hanging");
  const run = evaluatePlacement(zone);
  assert.equal(run.result, "FAIL");
  assert.ok(run.flags.includes("clearance_missing"));
  assert.equal(row(run, "hanging_clearance").result, "FAIL");
  assert.equal(row(run, "ground_anchor").result, "PASS");
  assert.equal(row(run, "part_colliders").result, "PASS");

  const unmeasured = structuredClone(good);
  delete unmeasured.path.min_clearance_m;
  const open = evaluatePlacement(unmeasured);
  assert.ok(open.flags.includes("clearance_missing"));
  assert.equal(row(open, "hanging_clearance").result, "FAIL");
});

test("a lintel under the path clearance fails", () => {
  const zone = structuredClone(good);
  const lintel = zone.library.arch.boxes.find((box) => box.id === "lintel");
  lintel.min[1] = 1;
  const run = evaluatePlacement(zone);
  assert.equal(run.result, "FAIL");
  assert.ok(run.flags.includes("clearance_tight"));
  assert.equal(row(run, "hanging_clearance").result, "FAIL");
  assert.equal(row(run, "part_colliders").result, "PASS");
  assert.ok(run.records.some((record) => record.collision === "hit"));
});

test("a keep-out in the opening is an invisible wall", () => {
  const zone = structuredClone(good);
  zone.library.arch.boxes.push({
    id: "seal",
    min: [-0.35, 0, -0.35],
    max: [0.35, 1.6, 0.35],
    role: "keepout",
  });
  const run = evaluatePlacement(zone);
  assert.equal(run.result, "FAIL");
  assert.ok(run.flags.includes("invisible_wall"));
  assert.equal(row(run, "part_colliders").result, "FAIL");
  assert.ok(row(run, "part_colliders").numbers.invisibleHits > 0);
  assert.equal(row(run, "ground_anchor").result, "PASS");
  assert.equal(row(run, "hanging_clearance").result, "PASS");
  assert.ok(run.records.some((record) => record.collision === "hit"));
  assert.equal(row(run, "approach_log").result, "PASS");
});

test("the approach log rejects a line that drops a required field", () => {
  const run = evaluatePlacement(good);
  const dropped = { ...run.records[0] };
  delete dropped.fps;
  const check = validateApproachRecord(dropped);
  assert.equal(check.ok, false);
  assert.ok(check.errors.includes("fps"));
  const hud = validateApproachRecord({ ...run.records[0], cameraLayer: "hud" });
  assert.ok(hud.errors.includes("cameraLayer"));
  const blocked = validateApproachRecord({ ...run.records[0], collision: "blocked" });
  assert.ok(blocked.errors.includes("collision"));
  const text = run.jsonl.replace('"fps":30', '"fps":-1');
  const parsed = parseApproachLog(text);
  assert.equal(parsed.ok, false);
  assert.ok(parsed.errors.some((error) => error.includes("fps")));
});

test("a circle clearing does not grow an approach placement", () => {
  const clearing = JSON.parse(readFileSync(path.join(here, "../fixture/clearing.json"), "utf8"));
  assert.equal(readPlacement(clearing), null);
  assert.equal(normalizeLayout(clearing).placement, undefined);
});
