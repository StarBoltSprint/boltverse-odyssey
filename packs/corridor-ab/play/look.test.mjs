import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHASE_BOOM,
  CHASE_EYE,
  SPRINT_MAX,
  WALK_SPD,
  chaseEye,
  chasePitch,
  chaseRight,
  chaseScreenY,
  chaseViewInto,
  GATE_TOP,
  horizonFromTop,
  PITCH_UP_MAX,
  pitchForTall,
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

const PORTRAIT_VFOV = 2 * Math.atan(Math.tan((22.7 * Math.PI) / 180 / 2) / (720 / 1600));

test("the chase stays high and the horizon sits in the top third", () => {
  const eye = chaseEye(90, 10, 4);
  assert.equal(eye[1], CHASE_EYE);
  assert.ok(eye[1] > 2.6 && eye[1] < 3.7);
  assert.ok(eye[0] < 10);
  const sky = horizonFromTop(PORTRAIT_VFOV);
  assert.ok(sky > 0.30 && sky < 0.35);
  assert.ok(chasePitch() < -0.08);
  const body = chaseScreenY(1.05, CHASE_BOOM, PORTRAIT_VFOV);
  assert.ok(body > 2 / 3);
  const archNear = chaseScreenY(7.4, 20 + CHASE_BOOM, PORTRAIT_VFOV);
  const archFar = chaseScreenY(7.4, 30 + CHASE_BOOM, PORTRAIT_VFOV);
  assert.ok(archNear > 0.02 && archNear < sky);
  assert.ok(archFar > 0.02 && archFar < sky);
});

test("a tall monolith raises the pitch and a far one does not", () => {
  const base = chasePitch();
  const far = pitchForTall(base, GATE_TOP, 200, PORTRAIT_VFOV);
  assert.equal(far, base);
  const close = pitchForTall(base, GATE_TOP, 80, PORTRAIT_VFOV);
  assert.ok(close >= base - 1e-9);
  assert.ok(close <= base + PITCH_UP_MAX + 1e-9);
  assert.ok(close > base);
  const top = chaseScreenY(GATE_TOP, 80, PORTRAIT_VFOV, close);
  assert.ok(top > 0.02 && top < 0.12);
  const capped = pitchForTall(base, GATE_TOP, 24, PORTRAIT_VFOV);
  assert.ok(Math.abs(capped - (base + PITCH_UP_MAX)) < 1e-9);
  assert.ok(capped >= base);
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
