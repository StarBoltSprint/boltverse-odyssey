import assert from "node:assert/strict";
import { test } from "node:test";
import { SPRINT_MAX } from "./look.js";
import {
  FIELD_HALF,
  CARPET_APRON,
  GATE_FIRST,
  GATE_LAT,
  HORIZON_N,
  NEAR_M,
  PASS_BACK,
  ROCK_SINK,
  bindPlan,
  carpetWest,
  createField,
  densityOf,
  halfWidth,
  horizonSeats,
  monumentSeat,
  planMonument,
  rockBottom,
  rockCount,
  settleField,
  slotIds,
  stepField,
} from "./stream.js";

function field() {
  return createField({ seed: 68, x0: 0.725, pathZ: 2.175 });
}

function body(x) {
  return { x, z: 2.175, heading: 90, forward: 1, gallop: false };
}

test("the same seed and the same speed history stream the same slots", () => {
  function replay() {
    const f = field();
    const b = body(4);
    b.gallop = true;
    const ids = [];
    for (let i = 0; i < 40; i++) {
      stepField(f, b, 1 / 30);
      ids.push(slotIds(f).join(","));
      b.x += f.speed * (1 / 30);
    }
    return ids.join("|");
  }
  assert.equal(replay(), replay());
});

function inCone(f, x) {
  const tan = Math.tan((22.7 * Math.PI) / 180 / 2);
  let n = 0;
  for (let i = 0; i < f.pool.length; i++) {
    const slot = f.pool[i];
    if (!slot.on || slot.kind > 2) continue;
    const ahead = slot.x - x;
    if (ahead <= 8) continue;
    if (Math.abs(slot.z - f.pathZ) < ahead * tan) n += 1;
  }
  return n;
}

test("a faster pace streams more rocks than a walk", () => {
  const walk = settleField(field(), body(6), "walk");
  const sprint = settleField(field(), body(6), "sprint");
  assert.ok(rockCount(sprint) > rockCount(walk) + 6);
  assert.ok(inCone(sprint, 6) > inCone(walk, 6));
  assert.ok(inCone(sprint, 6) >= 8);
  assert.ok(sprint.speed === SPRINT_MAX);
  assert.ok(densityOf(1) > densityOf(0));
  assert.ok(halfWidth(1) > halfWidth(0) + 20);
  assert.ok(halfWidth(1) > 30);
  assert.ok(FIELD_HALF > 40);
});

function rockSig(f) {
  const parts = [];
  for (let i = 0; i < f.pool.length; i++) {
    const slot = f.pool[i];
    if (!slot.on || slot.kind > 2) continue;
    parts.push(slot.x.toFixed(2) + ":" + slot.yaw.toFixed(1));
  }
  return parts.sort().join("|");
}

test("a second seed moves a rock", () => {
  const a = settleField(field(), body(6), "sprint");
  const b = settleField(createField({ seed: 69, x0: 0.725, pathZ: 2.175 }), body(6), "sprint");
  assert.notEqual(rockSig(a), rockSig(b));
});

test("a new slot is not planted inside the near radius", () => {
  const f = field();
  const b = body(8);
  b.gallop = true;
  stepField(f, b, 1 / 30);
  for (let i = 0; i < f.pool.length; i++) {
    const slot = f.pool[i];
    if (!slot.on || slot.kind > 2 || slot.emerge > 0.2) continue;
    const ahead = slot.x - b.x;
    if (ahead < 0) continue;
    assert.ok(ahead >= NEAR_M - 1.5);
  }
});

test("easing keeps rocks a sprint already woke", () => {
  const woke = field();
  const b = body(6);
  b.gallop = true;
  for (let i = 0; i < 150; i++) stepField(woke, b, 1 / 30);
  const full = rockCount(woke);
  b.gallop = false;
  b.forward = 1;
  for (let i = 0; i < 10; i++) stepField(woke, b, 1 / 30);
  const walk = settleField(field(), body(b.x), "walk");
  assert.ok(full > rockCount(walk));
  assert.ok(rockCount(woke) > rockCount(walk));
});

test("the arch and the wreck sit on the run and the gate waits for sprint", () => {
  const walk = settleField(field(), body(6), "walk");
  const sprint = settleField(field(), body(6), "sprint");
  assert.ok(walk.arch);
  assert.ok(Math.abs(walk.arch.z - 2.175) < 0.01);
  assert.ok(walk.wreck);
  assert.ok(Math.abs(walk.wreck.z - 2.175) > 2);
  assert.equal(walk.gate, null);
  assert.ok(sprint.gate);
  assert.ok(Math.abs(Math.abs(sprint.gate.z - 2.175) - GATE_LAT) < 0.01);
  const seat = monumentSeat(field(), 3, 6, 40, 22, 0);
  assert.ok(seat.x > 6);
});

test("a sprint sees the gate while it is still inside the forward view", () => {
  const gateX = 0.725 + 54;
  const sprint = settleField(field(), body(gateX - 100), "sprint");
  assert.ok(sprint.gate);
  assert.ok(Math.abs(sprint.gate.x - gateX) < 0.2);
  const walk = settleField(field(), body(gateX - 100), "walk");
  assert.equal(walk.gate, null);
});

test("the carpet covers the ground under the pass camera", () => {
  const x0 = 0.725;
  const pass = x0 + GATE_FIRST - PASS_BACK;
  const west = carpetWest(x0, pass);
  assert.ok(west <= pass - CARPET_APRON + 1e-9);
  assert.ok(west <= x0 - CARPET_APRON + 1e-9);
  assert.ok(pass < x0 - 40);
});

test("a rock bottom stays under the plane through the rise", () => {
  assert.equal(rockBottom(1), -ROCK_SINK);
  assert.ok(rockBottom(0.4) < -ROCK_SINK);
  assert.ok(rockBottom(0) < rockBottom(0.4));
});

test("horizon seats are tall, in the forward view, and clear of the run", () => {
  const seats = horizonSeats(field(), 6);
  assert.equal(seats.length, HORIZON_N);
  const half = Math.tan((22.7 * Math.PI) / 180 / 2);
  for (let i = 0; i < seats.length; i++) {
    const seat = seats[i];
    const dist = seat.x - 6;
    assert.ok(seat.height >= 8);
    assert.ok(Math.abs(seat.lateral) > 0.8 * seat.height);
    assert.ok(Math.abs(seat.lateral) < dist * half);
    assert.ok(seat.kind === 1 || seat.kind === 2);
  }
});

test("an adventure plan seats the gate at the end and keeps the seed", () => {
  const plan = {
    seed: 24,
    lengthM: 60,
    objects: ["stone", "arch", "gate"],
    density: [0.9, 0.9, 0.9, 1],
  };
  function replay() {
    const f = field();
    bindPlan(f, plan);
    return slotIds(settleField(f, body(6), "sprint")).join(",");
  }
  assert.equal(replay(), replay());
  const f = field();
  bindPlan(f, plan);
  settleField(f, body(6), "sprint");
  assert.equal(f.seed, 24);
  assert.equal(f.wreck, null);
  assert.ok(f.gate);
  const gate = planMonument(60, "gate");
  assert.ok(Math.abs(f.gate.x - (0.725 + gate.along)) < 1);
  const sparse = field();
  bindPlan(sparse, { seed: 24, lengthM: 60, objects: ["stone", "gate"], density: [0.15, 0.15, 0.15, 0.15] });
  settleField(sparse, body(6), "sprint");
  const full = field();
  bindPlan(full, { seed: 24, lengthM: 60, objects: ["stone", "boulder", "gate"], density: [1, 1, 1, 1] });
  settleField(full, body(6), "sprint");
  assert.ok(rockCount(full) > rockCount(sparse));
});
