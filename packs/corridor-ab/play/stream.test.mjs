import assert from "node:assert/strict";
import { test } from "node:test";
import { CHARGE_RAMP_SEC, SPRINT_MAX, SPRINT_TOP, WALK_SPD } from "./look.js";
import {
  DRAW_BATCHES,
  FIELD_HALF,
  CARPET_APRON,
  GATE_FIRST,
  HORIZON_FAR,
  HORIZON_NEAR,
  HORIZON_N,
  INST_CAP,
  PASS_BACK,
  POOL,
  ROCK_SINK,
  SPAWN_M,
  bindPlan,
  carpetWest,
  createField,
  densityOf,
  GATE_CLEAR,
  MONU_CAP,
  bandHalf,
  census,
  drawBudget,
  halfWidth,
  horizonSeats,
  lookAhead,
  monumentBudget,
  monumentSeat,
  spawnDistance,
  visibleDensity,
  planMonument,
  rockBottom,
  rockCount,
  seatSink,
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
  assert.equal(halfWidth(1), halfWidth(0));
  assert.ok(halfWidth(1) > 12);
  assert.equal(halfWidth(1), bandHalf(SPAWN_M));
  assert.ok(FIELD_HALF > 40);
  assert.ok(drawBudget(MONU_CAP) <= 12);
  assert.equal(monumentBudget(0), 1);
  assert.equal(monumentBudget(1), MONU_CAP);
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

function axes(b) {
  const yaw = b.heading * Math.PI / 180;
  return {
    fx: Math.sin(yaw),
    fz: Math.cos(yaw),
    rx: Math.cos(yaw),
    rz: -Math.sin(yaw),
  };
}

function aheadOf(slot, b) {
  const a = axes(b);
  return (slot.x - b.x) * a.fx + (slot.z - b.z) * a.fz;
}

function sideOf(slot, b) {
  const a = axes(b);
  return (slot.x - b.x) * a.rx + (slot.z - b.z) * a.rz;
}

function inNearFrustum(slot, b) {
  const yaw = b.heading * Math.PI / 180;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  const dx = slot.x - b.x;
  const dz = slot.z - b.z;
  const ahead = dx * fx + dz * fz;
  const side = dx * rx + dz * rz;
  const tan = Math.tan((22.7 * Math.PI) / 180 / 2);
  return ahead >= 0 && ahead < SPAWN_M && Math.abs(side) < ahead * tan + 0.6;
}

function birthsDuring(seconds, turn) {
  const f = field();
  const b = body(6);
  b.gallop = true;
  const dt = 1 / 30;
  const born = [];
  stepField(f, b, dt);
  b.x += f.speed * dt;
  const primed = new Set(slotIds(f));
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    if (turn && i === 30) b.heading = 0;
    const before = new Set(slotIds(f));
    stepField(f, b, dt);
    for (let s = 0; s < f.pool.length; s++) {
      const slot = f.pool[s];
      if (!slot.on || before.has(slot.id) || primed.has(slot.id)) continue;
      born.push({
        id: slot.id,
        ahead: aheadOf(slot, b),
        side: sideOf(slot, b),
        frustum: inNearFrustum(slot, b),
        kind: slot.kind,
      });
    }
    const yaw = b.heading * Math.PI / 180;
    b.x += Math.sin(yaw) * f.speed * dt;
    b.z += Math.cos(yaw) * f.speed * dt;
  }
  return { field: f, body: b, born };
}

test("a new slot is born beyond the far ring and outside the near frustum", () => {
  const run = birthsDuring(4, false);
  assert.ok(run.born.length > 0);
  for (let i = 0; i < run.born.length; i++) {
    const rec = run.born[i];
    assert.ok(rec.ahead >= SPAWN_M - 2, "ahead " + rec.ahead);
    assert.equal(rec.frustum, false);
  }
});

test("a turn births across the forward band and stays outside the near frustum", () => {
  const run = birthsDuring(3, true);
  let wide = 0;
  for (let i = 0; i < run.born.length; i++) {
    const rec = run.born[i];
    assert.equal(rec.frustum, false);
    assert.ok(rec.ahead >= SPAWN_M - 2, "ahead " + rec.ahead);
    if (Math.abs(rec.side) > 12) wide += 1;
  }
  assert.ok(wide > 0, "wide births " + wide);
});

test("a long sprint holds more rocks than a short one, still born far", () => {
  const short = birthsDuring(2, false);
  const long = birthsDuring(22, false);
  assert.ok(long.field.charge > short.field.charge + 0.5);
  assert.ok(densityOf(long.field.charge) > densityOf(short.field.charge) + 0.3);
  assert.ok(rockCount(long.field) > rockCount(short.field));
  assert.ok(rockCount(long.field) <= POOL);
  assert.ok(long.born.length > short.born.length);
  assert.ok(POOL + HORIZON_N <= INST_CAP * DRAW_BATCHES);
  for (let i = 0; i < long.born.length; i++) {
    assert.ok(long.born[i].ahead >= SPAWN_M - 2);
    assert.equal(long.born[i].frustum, false);
  }
});

test("easing keeps rocks a sprint already woke", () => {
  const woke = field();
  const b = body(6);
  b.gallop = true;
  for (let i = 0; i < 150; i++) stepField(woke, b, 1 / 30);
  const full = rockCount(woke);
  const ids = slotIds(woke).join(",");
  b.gallop = false;
  b.forward = 1;
  for (let i = 0; i < 10; i++) stepField(woke, b, 1 / 30);
  assert.ok(full > 4);
  assert.equal(rockCount(woke), full);
  assert.equal(slotIds(woke).join(","), ids);
});

function monumentSides(f) {
  const sides = [];
  for (let i = 0; i < f.pool.length; i++) {
    const slot = f.pool[i];
    if (!slot.on || slot.kind < 3) continue;
    sides.push(slot.z - f.pathZ);
  }
  return sides;
}

test("a sprint seats arches, the gate, and the wreck across the far band", () => {
  const walk = settleField(field(), body(6), "walk");
  const sprint = settleField(field(), body(6), "sprint");
  assert.equal(walk.arch, null);
  assert.equal(walk.gate, null);
  assert.equal(walk.wreck, null);
  const counted = census(sprint);
  assert.ok(counted.counts.arch >= 1);
  assert.ok(counted.counts.gate >= 1);
  assert.ok(counted.counts.wreck >= 1);
  assert.ok(counted.counts.arch <= MONU_CAP);
  assert.ok(counted.counts.gate <= MONU_CAP);
  assert.ok(counted.counts.wreck <= MONU_CAP);
  const sides = monumentSides(sprint);
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < sides.length; i++) {
    if (sides[i] < lo) lo = sides[i];
    if (sides[i] > hi) hi = sides[i];
  }
  assert.ok(lo < -8, "left " + lo);
  assert.ok(hi > 8, "right " + hi);
  assert.ok(hi - lo > 20);
  for (let i = 0; i < sprint.pool.length; i++) {
    const slot = sprint.pool[i];
    if (!slot.on || slot.kind < 3) continue;
    const ahead = slot.x - 6;
    assert.ok(ahead >= SPAWN_M - 2, "monument ahead " + ahead);
    if (slot.kind === 4) assert.ok(Math.abs(slot.z - sprint.pathZ) >= GATE_CLEAR - 0.01);
  }
  let rockLo = Infinity;
  let rockHi = -Infinity;
  for (let i = 0; i < sprint.pool.length; i++) {
    const slot = sprint.pool[i];
    if (!slot.on || slot.kind > 2) continue;
    const side = slot.z - sprint.pathZ;
    if (side < rockLo) rockLo = side;
    if (side > rockHi) rockHi = side;
  }
  assert.ok(rockLo < -12, "rock left " + rockLo);
  assert.ok(rockHi > 12, "rock right " + rockHi);
  const seat = monumentSeat(field(), 3, 6, 40, 22, 0);
  assert.ok(seat.x > 6);
});

test("a sprint sees monuments inside the forward view and a walk does not", () => {
  const sprint = settleField(field(), body(6), "sprint");
  assert.ok(sprint.gate);
  assert.ok(sprint.gate.x - 6 <= lookAhead(SPRINT_MAX, 1) + 1);
  const walk = settleField(field(), body(6), "walk");
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

test("a rock bottom stays under the plane at every emerge", () => {
  assert.equal(rockBottom(1), -ROCK_SINK);
  assert.equal(rockBottom(0.4), -ROCK_SINK);
  assert.equal(rockBottom(0), -ROCK_SINK);
  assert.ok(rockBottom(1) < 0);
  assert.ok(seatSink(14) >= 0.7 - 1e-9);
  assert.ok(seatSink(8) >= ROCK_SINK);
});

test("horizon seats are world-locked, tall, and the newest enters far", () => {
  const a = horizonSeats(field(), 6);
  const b = horizonSeats(field(), 10);
  assert.equal(a.length, HORIZON_N);
  const byX = new Map();
  for (let i = 0; i < a.length; i++) byX.set(a[i].x, a[i]);
  let shared = 0;
  for (let i = 0; i < b.length; i++) {
    const prev = byX.get(b[i].x);
    if (!prev) continue;
    shared += 1;
    assert.equal(b[i].z, prev.z);
    assert.equal(b[i].yaw, prev.yaw);
    assert.equal(b[i].height, prev.height);
  }
  assert.ok(shared >= HORIZON_N - 1);
  const half = Math.tan((22.7 * Math.PI) / 180 / 2) * 0.82;
  let far = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const seat = a[i];
    if (seat.x > far) far = seat.x;
    assert.ok(seat.height >= 8);
    assert.ok(Math.abs(seat.lateral) > 0.8 * seat.height);
    assert.ok(Math.abs(seat.lateral) < HORIZON_FAR * half + 0.01);
    assert.ok(seat.kind === 1 || seat.kind === 2);
    assert.ok(-seatSink(seat.height) <= -ROCK_SINK);
    assert.ok(seat.x - 6 >= HORIZON_NEAR - 1e-6);
  }
  assert.ok(far - 6 > SPAWN_M);
});

test("walk look stays short of a far gate and a sprint look reaches it", () => {
  assert.ok(lookAhead(WALK_SPD, 0) < 100);
  assert.ok(lookAhead(SPRINT_MAX, 1) > 100);
  assert.ok(lookAhead(SPRINT_TOP, 1) > spawnDistance(SPRINT_TOP));
  assert.ok(spawnDistance(SPRINT_TOP) >= SPAWN_M);
  assert.ok(CHARGE_RAMP_SEC >= 20 && CHARGE_RAMP_SEC <= 30);
});

test("rocks per visible area rise across a long sprint", () => {
  function at(seconds) {
    const f = field();
    const b = body(6);
    b.gallop = true;
    const dt = 1 / 30;
    const steps = Math.round(seconds / dt);
    for (let i = 0; i < steps; i++) {
      stepField(f, b, dt);
      const yaw = b.heading * Math.PI / 180;
      b.x += Math.sin(yaw) * f.speed * dt;
      b.z += Math.cos(yaw) * f.speed * dt;
    }
    return { field: f, body: b, vis: visibleDensity(f, b) };
  }
  const a = at(8);
  const b = at(16);
  const c = at(24);
  assert.ok(c.vis.density > b.vis.density, c.vis.density + " > " + b.vis.density);
  assert.ok(b.vis.density > a.vis.density, b.vis.density + " > " + a.vis.density);
  assert.ok(c.vis.count > b.vis.count);
  assert.ok(b.vis.count > a.vis.count);
  assert.equal(a.vis.half, c.vis.half);
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
