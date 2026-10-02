import assert from "node:assert/strict";
import test from "node:test";
import {
  blockedBy,
  cameraBasis,
  chaseBasis,
  isRingWall,
  viewIndexForEyeYaw,
} from "./basis.mjs";

const YAWS = [0, 45, 90, 135, 180, 225, 270, 315];

test("yaw 0 eye sits on +Z and screen-right is +X", () => {
  const cam = cameraBasis(0, 3, 0, null);
  assert.ok(Math.abs(cam.position[0]) < 1e-9);
  assert.ok(cam.position[2] > 0);
  assert.ok(cam.forward[2] < 0);
  assert.ok(cam.right[0] > 0.99);
  assert.ok(Math.abs(cam.right[1]) < 1e-9);
  assert.ok(Math.abs(cam.right[2]) < 1e-6);
});

test("positive yaw moves the eye toward +X", () => {
  const cam = cameraBasis(90, 3, 0, null);
  assert.ok(cam.position[0] > 0);
  assert.ok(Math.abs(cam.position[2]) < 1e-6);
});

test("chase heading 180 matches the yaw-0 hull right", () => {
  const hull = cameraBasis(0, 3, 0, null);
  const chase = chaseBasis(180);
  assert.ok(chase.forward[2] < 0);
  assert.ok(Math.abs(chase.right[0] - hull.right[0]) < 1e-9);
  assert.ok(chase.right[0] > 0.99);
  const mirrored = [-chase.right[0], -chase.right[1], -chase.right[2]];
  assert.ok(Math.abs(mirrored[0] - hull.right[0]) > 1);
});

test("view index follows bearing, not its mirror", () => {
  assert.equal(YAWS[viewIndexForEyeYaw(90, YAWS)], 90);
  assert.equal(YAWS[viewIndexForEyeYaw(270, YAWS)], 270);
  assert.equal(YAWS[viewIndexForEyeYaw(20, YAWS)], 0);
  assert.equal(YAWS[viewIndexForEyeYaw(30, YAWS)], 45);
  assert.notEqual(YAWS[viewIndexForEyeYaw(90, YAWS)], 270);
});

test("a ring-radius circle at the zone centre is a wall, stone footprints are not", () => {
  const stones = [
    { id: "ring-00", center: [17.9, 0], radius_m: 1.34 },
    { id: "ring-22", center: [16.2, 6.4], radius_m: 1.34 },
  ];
  assert.equal(isRingWall([0, 0], 17.92, stones), false);
  assert.equal(blockedBy(16.69, 6.53, 0.3, stones)?.id, "ring-22");
  const outside = blockedBy(12, 0, 0.3, stones);
  assert.equal(outside, null);
  const wall = [{ id: "ring-wall", center: [0, 0], radius_m: 17.92 }];
  assert.equal(isRingWall([0, 0], 17.92, wall), true);
  assert.equal(blockedBy(16.69, 6.53, 0.3, wall)?.id, "ring-wall");
});
