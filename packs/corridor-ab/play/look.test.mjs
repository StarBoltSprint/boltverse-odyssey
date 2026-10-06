import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHASE_EYE,
  SPRINT_MAX,
  WALK_SPD,
  chaseEye,
  chasePitch,
  chaseRight,
  chaseViewInto,
  createLook,
  forwardOf,
  pawLine,
  pushLook,
  stepLook,
  stepSpeed,
} from "./look.js";

test("a vertical swipe tilts, then the spring eases back to level", () => {
  const look = createLook();
  look.drag = true;
  pushLook(look, 200);
  assert.ok(look.goal > 0.5);
  for (let i = 0; i < 30; i++) stepLook(look, 1 / 30);
  const tilted = look.cur;
  assert.ok(tilted > 0.2);
  look.drag = false;
  look.goal = 0;
  for (let i = 0; i < 180; i++) stepLook(look, 1 / 30);
  assert.ok(Math.abs(look.cur) < 0.02);
  assert.ok(tilted > Math.abs(look.cur));
});

test("stick right turns toward camera right", () => {
  const right = chaseRight(90);
  const before = forwardOf(90);
  const after = forwardOf(91);
  const dot = (v) => v[0] * right[0] + v[2] * right[2];
  assert.ok(dot(after) > dot(before));
  const view = new Float32Array(16);
  chaseViewInto(view, [0, 2, 0], [8, 2, 0]);
  assert.ok(Math.abs(view[8] - right[2]) < 1e-4);
});

test("the chase sits higher and looks down from behind Bolt", () => {
  const eye = chaseEye(90, 10, 4);
  assert.ok(eye[1] > 2.6);
  assert.equal(eye[1], CHASE_EYE);
  assert.ok(eye[0] < 10);
  assert.ok(chasePitch() < -0.2);
});

test("sprint climbs while the stick is held and eases on release", () => {
  let speed = 0;
  for (let i = 0; i < 15; i++) speed = stepSpeed(speed, 1, true, 1 / 30);
  const early = speed;
  assert.ok(early > 0.4);
  assert.ok(early < SPRINT_MAX * 0.5);
  for (let i = 0; i < 180; i++) speed = stepSpeed(speed, 1, true, 1 / 30);
  assert.ok(speed > SPRINT_MAX - 0.05);
  for (let i = 0; i < 20; i++) speed = stepSpeed(speed, 1, false, 1 / 30);
  assert.ok(speed < SPRINT_MAX - 0.5);
  assert.ok(speed > WALK_SPD);
});

test("a harder sprint push accelerates faster than a light one", () => {
  let light = WALK_SPD;
  let hard = WALK_SPD;
  light = stepSpeed(light, 0.75, true, 0.5);
  hard = stepSpeed(hard, 1, true, 0.5);
  assert.ok(hard > light);
});

test("the paw row sits on the ground", () => {
  assert.ok(Math.abs(pawLine(0, 2.15, 0.92)) < 1e-6);
  assert.ok(Math.abs(pawLine(0, 2.15, 0.88)) < 1e-6);
});
