import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHASE_AIM_Y,
  CHASE_BOOM,
  CHASE_EYE,
  CHASE_SLIDE,
  SPRINT_MAX,
  SPRINT_TOP,
  WALK_SPD,
  chaseEye,
  chasePitch,
  chaseRight,
  chaseScreenY,
  chaseViewInto,
  GATE_TOP,
  horizonFromTop,
  PITCH_UP_MAX,
  pitchForEye,
  pitchForTall,
  createLook,
  forwardOf,
  pawLine,
  pushLook,
  holdBody,
  sprintCap,
  stepCharge,
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

function zoneAScreenY(worldY) {
  const boom = 6;
  const eye = 1.35;
  const aim = 2.15 * 0.45;
  const pitch = Math.atan2(aim - eye, boom);
  const ang = Math.atan2(worldY - eye, boom) - pitch;
  const ndc = Math.tan(ang) / Math.tan(PORTRAIT_VFOV * 0.5);
  return 0.5 - ndc * 0.5;
}

test("the chase matches zone A and stays clear of the joystick", () => {
  const eye = chaseEye(90, 10, 4);
  assert.equal(eye[1], CHASE_EYE);
  assert.equal(CHASE_EYE, 1.35);
  assert.equal(CHASE_BOOM, 6);
  assert.equal(CHASE_SLIDE, 0);
  assert.ok(Math.abs(CHASE_AIM_Y - 2.15 * 0.45) < 1e-9);
  assert.ok(eye[0] < 10);
  assert.ok(Math.abs(eye[2] - 4) < 1e-6);
  assert.ok(Math.abs(eye[0] - (10 - CHASE_BOOM)) < 1e-9);
  const body = chaseScreenY(1.05, CHASE_BOOM, PORTRAIT_VFOV);
  const zone = zoneAScreenY(1.05);
  assert.ok(Math.abs(body - zone) < 0.03, "body " + body + " zone " + zone);
  assert.ok(Math.abs(body - 0.5) < 0.08);
  const paw = chaseScreenY(0, CHASE_BOOM, PORTRAIT_VFOV);
  assert.ok(paw < 0.88, "paw " + paw);
  const sky = horizonFromTop(PORTRAIT_VFOV);
  assert.ok(sky > 0.2 && sky < 0.8);
});

test("a lifted eye keeps the chest on the zone A row", () => {
  const zone = zoneAScreenY(1.05);
  for (const eyeY of [1.35, 2.4, 3.6, 5.2]) {
    const pitch = pitchForEye(eyeY, CHASE_BOOM);
    const ang = Math.atan2(1.05 - eyeY, CHASE_BOOM) - pitch;
    const y = 0.5 - (Math.tan(ang) / Math.tan(PORTRAIT_VFOV * 0.5)) * 0.5;
    assert.ok(Math.abs(y - zone) < 0.03, eyeY + " " + y.toFixed(3) + " zone " + zone.toFixed(3));
  }
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

test("a held sprint climbs past the old top across the charge ramp", () => {
  let speed = 0;
  let charge = 0;
  const dt = 1 / 30;
  let mid = 0;
  const midAt = Math.round(8 / dt);
  const endAt = Math.round(26 / dt);
  let prev = 0;
  for (let i = 0; i < endAt; i++) {
    charge = stepCharge(charge, 1, true, dt);
    speed = stepSpeed(speed, 1, true, dt, charge);
    assert.ok(speed + 1e-9 >= prev);
    prev = speed;
    if (i + 1 === midAt) mid = speed;
  }
  assert.ok(mid > SPRINT_MAX * 0.9, "mid " + mid);
  assert.ok(mid < SPRINT_TOP * 0.8, "mid " + mid);
  assert.ok(speed > SPRINT_MAX * 2, "top " + speed);
  assert.ok(speed < SPRINT_MAX * 2.5 + 1e-6, "top " + speed);
  assert.ok(Math.abs(speed - SPRINT_TOP) < 0.05);
  assert.ok(Math.abs(sprintCap(1) - SPRINT_TOP) < 1e-9);
  assert.equal(sprintCap(0), SPRINT_MAX);
});

test("a zone handoff does not move the body", () => {
  const pose = { x: 40.2, z: 2.1, heading: 90 };
  const held = holdBody(pose, { mode: "zone", zoneId: "zone-b" }, "corridor");
  assert.equal(held.x, pose.x);
  assert.equal(held.z, pose.z);
  assert.equal(held.heading, 90);
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
