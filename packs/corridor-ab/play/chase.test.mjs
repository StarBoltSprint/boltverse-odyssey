import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import {
  CHASE_BOOM,
  CHASE_EYE,
  chaseEye,
  CHASE_PITCH_RATE,
  CHASE_PUSH_RATE,
  LOOK_V_DRAG,
  SPRINT_MAX,
  TURN_DPS,
  chasePitch,
  chaseScreenY,
  createChase,
  forwardOf,
  kinematicStep,
  pitchForTall,
  resetChase,
  stepChase,
  wrap360,
} from "./look.js";
import {
  BOOM_CAP,
  FOCAL,
  MAG_LIMIT,
  VFOV,
  artFloor,
  boomOf,
  clearEye,
  restBoom,
  restEye,
  rockShells,
  ruinShownMag,
} from "./mag.js";
import { GATE_CLOSE_SWITCH } from "../../zone-a/play/ruins.js";
import { pushDiscs } from "./scatter.js";
import { POOL, createField, rockDiscs, settleField, stepField } from "./stream.js";
import { sweepPose } from "./measure-mag.mjs";

const layout = JSON.parse(readFileSync(new URL("../path-layout.json", import.meta.url), "utf8"));
const corridor = layout.corridors[0];
const x0 = corridor.waypoints[0][0];
const pathZ = corridor.waypoints[0][1];
const PORTRAIT = VFOV;

test("the rest chase matches zone A and the boom cap stays behind Bolt", () => {
  const body = chaseScreenY(1.05, CHASE_BOOM, PORTRAIT);
  assert.ok(body > 0.4 && body < 0.6, "body " + body);
  assert.ok(restBoom() < BOOM_CAP);
  assert.equal(restBoom(), CHASE_BOOM);
  const paw = chaseScreenY(0, CHASE_BOOM, PORTRAIT);
  assert.ok(paw < 0.88, "paw " + paw);
});

test("clearance stays on the rest ray so Bolt stays centred", () => {
  const rigid = chaseEye(90, 0, 0);
  const eye = clearEye(rigid, 0, 0, [{
    id: "boulder:1",
    x: 4,
    y: 1,
    z: 2.2,
    rad: 1.2,
    worldH: 1.4,
    srcH: 512,
  }], { arch: null, gate: null, wreck: null });
  assert.ok(Math.abs(eye[2]) < 1e-6);
  assert.equal(eye[1], CHASE_EYE);
  assert.ok(eye[0] < 0);
});

test("the gate plate takes over at magnification 1", () => {
  assert.equal(GATE_CLOSE_SWITCH, 1);
  const far = 16.593;
  const shown = ruinShownMag("gate", far);
  assert.ok(shown < MAG_LIMIT, "plate at 16.6 m is " + shown);
  const close = ruinShownMag("gate", 5.6);
  assert.ok(close > 1);
  assert.ok(5.6 < artFloor("gate"));
});

test("hull and ruin samplers use explicit gradients and anisotropy", () => {
  const hull = readFileSync(new URL("../../zone-a/play/hullmesh.js", import.meta.url), "utf8");
  const ruins = readFileSync(new URL("../../zone-a/play/ruins.js", import.meta.url), "utf8");
  assert.match(hull, /textureGrad\(uViews/);
  assert.equal((hull.match(/texture\(uViews/g) || []).length, 0);
  assert.match(hull, /TEXTURE_MAX_ANISOTROPY_EXT/);
  assert.match(ruins, /CLOSE_LO = 0.92/);
  assert.match(ruins, /CLOSE_HI = 1.0/);
  assert.match(ruins, /TEXTURE_MAX_ANISOTROPY_EXT/);
  const play = readFileSync(new URL("./play.js", import.meta.url), "utf8");
  assert.match(play, /sky\.draw\(vp, eyeBuf, cam\.yaw\)/);
});

test("a steady sprint follows with no lag and a shove does not land in one frame", () => {
  const cam = createChase();
  const dt = 1 / 60;
  let x = 0;
  const rest = () => [x, CHASE_EYE, -CHASE_BOOM];
  stepChase(cam, rest(), rest(), chasePitch(), dt, true, 0, 0);
  let prev = cam.eye[0];
  for (let i = 0; i < 90; i++) {
    x += SPRINT_MAX * dt;
    const target = rest();
    stepChase(cam, target, target, chasePitch(), dt, false, SPRINT_MAX, 0);
    assert.ok(Math.abs(cam.eye[0] - x) < 1e-4);
    const step = Math.abs(cam.eye[0] - prev);
    assert.ok(step < kinematicStep(SPRINT_MAX, 0, dt) + 1e-4);
    prev = cam.eye[0];
  }
  const jumped = [x + 2.4, CHASE_EYE, -CHASE_BOOM];
  stepChase(cam, jumped, jumped, chasePitch(), dt, false, SPRINT_MAX, 0);
  const moved = Math.abs(cam.eye[0] - prev);
  const allow = kinematicStep(SPRINT_MAX, 0, dt) + CHASE_PUSH_RATE * dt + 1e-4;
  assert.ok(moved <= allow, "shove frame moved " + moved + " allow " + allow);
  assert.ok(Math.abs(cam.eye[0] - jumped[0]) > 1);
});

test("a tall-monolith pitch step is spread across frames", () => {
  const cam = createChase();
  const dt = 1 / 60;
  const base = chasePitch();
  const goal = pitchForTall(base, 28, 24, PORTRAIT);
  assert.ok(goal > base + 0.15);
  const eye = [0, CHASE_EYE, -6];
  stepChase(cam, eye, eye, base, dt, true, 0, 0);
  stepChase(cam, eye, eye, goal, dt, false, 0, 0);
  const dp = Math.abs(cam.pitch - base);
  const allow = LOOK_V_DRAG * dt + CHASE_PITCH_RATE * dt + 0.004;
  assert.ok(dp <= allow + 1e-4, "pitch step " + dp);
  assert.ok(Math.abs(cam.pitch - goal) > 0.05);
  resetChase(cam);
});

test("headings 82 and 127 at the sprint start stay under the limit", () => {
  for (const h of [82, 127, 90]) {
    const row = sweepPose("sprint", x0 + 6, h);
    for (const hit of row.hits) {
      if (!hit.visible) continue;
      assert.ok(hit.mag <= MAG_LIMIT + 1e-3, h + " " + hit.id + " " + hit.mag);
    }
  }
});

test("the old gate elevation row is on the plate and under the limit", () => {
  const row = sweepPose("walk", x0 + 54, 330);
  const gate = row.hits.find((h) => h.id === "gate");
  assert.ok(gate);
  assert.ok(gate.mag <= MAG_LIMIT, "gate " + gate.mag + " at " + gate.dist);
});

test("scripted run: camera deltas stay inside the continuous bound", () => {
  const field = createField({ seed: layout.seed || 1, x0, pathZ });
  const discs = [];
  for (let i = 0; i < POOL; i++) discs.push({ x: 0, z: 0, r: 0 });
  let x = x0 + 4;
  let z = pathZ;
  let heading = 90;
  const cam = createChase();
  const dt = 1 / 60;
  const seconds = 9;
  const frames = Math.round(seconds / dt);
  let prevEye = null;
  let prevPitch = 0;
  let maxPos = 0;
  let maxPitch = 0;
  let maxStepMs = 0;
  let sumStep = 0;
  const samples = [];
  let spikes = 0;
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now();
    const t = i * dt;
    let forward = 0.55;
    let gallop = false;
    let turn = 0;
    if (t >= 2 && t < 5.5) {
      forward = 1;
      gallop = true;
    } else if (t >= 5.5 && t < 7.5) {
      forward = 1;
      gallop = true;
      turn = 1;
    } else if (t >= 7.5) {
      forward = 1;
      gallop = true;
    }
    stepField(field, { x, z, heading, forward, gallop }, dt);
    heading = wrap360(heading + turn * TURN_DPS * dt);
    const yaw = heading * Math.PI / 180;
    let nx = x + Math.sin(yaw) * field.speed * dt;
    let nz = z + Math.cos(yaw) * field.speed * dt;
    const n = rockDiscs(field, discs);
    const pushed = pushDiscs(nx, nz, discs.slice(0, n), 0.3);
    if (i === Math.round(6 / dt)) pushed.x += 1.2;
    x = pushed.x;
    z = pushed.z;
    const rigid = restEye(heading, x, z);
    let pitch = chasePitch();
    if (field.gate && field.gate.emerge > 0.4) {
      const f = forwardOf(heading);
      const dx = field.gate.x - rigid[0];
      const dz = field.gate.z - rigid[2];
      const ahead = dx * f[0] + dz * f[2];
      if (ahead > 12) pitch = pitchForTall(pitch, 28, Math.max(1, ahead), PORTRAIT);
    }
    const eye = clearEye(rigid, x, z, rockShells(field.pool), field);
    stepChase(cam, rigid, eye, pitch, dt, i === 0, field.speed, turn);
    const stepMs = performance.now() - t0;
    if (stepMs > maxStepMs) maxStepMs = stepMs;
    sumStep += stepMs;
    if (prevEye) {
      const d = Math.hypot(cam.eye[0] - prevEye[0], cam.eye[1] - prevEye[1], cam.eye[2] - prevEye[2]);
      const allow = kinematicStep(field.speed, turn, dt) + CHASE_PUSH_RATE * dt + 1e-3;
      const dp = Math.abs(cam.pitch - prevPitch);
      const pAllow = LOOK_V_DRAG * dt + CHASE_PITCH_RATE * dt + 0.006;
      if (d > allow || dp > pAllow) spikes += 1;
      if (d > maxPos) maxPos = d;
      if (dp > maxPitch) maxPitch = dp;
      if (i % 30 === 0) {
        samples.push({
          t: Math.round(t * 100) / 100,
          dM: Math.round(d * 1000) / 1000,
          allowM: Math.round(allow * 1000) / 1000,
          dPitch: Math.round(dp * 10000) / 10000,
          speed: Math.round(field.speed * 100) / 100,
          stepMs: Math.round(stepMs * 100) / 100,
          boom: Math.round(boomOf(cam.eye, x, z) * 1000) / 1000,
        });
      }
    }
    prevEye = [cam.eye[0], cam.eye[1], cam.eye[2]];
    prevPitch = cam.pitch;
  }
  const meanStep = sumStep / frames;
  const summary = {
    dt,
    frames,
    spikes,
    maxPosM: Math.round(maxPos * 1000) / 1000,
    maxPitchRad: Math.round(maxPitch * 10000) / 10000,
    maxStepMs: Math.round(maxStepMs * 100) / 100,
    meanStepMs: Math.round(meanStep * 100) / 100,
    samples,
  };
  let minBoom = Infinity;
  for (const s of samples) if (s.t > 0.5 && s.t < 5.5 && s.boom < minBoom) minBoom = s.boom;
  summary.minBoomWhileStraight = minBoom;
  writeFileSync(new URL("../proof/smooth/camera-trace.json", import.meta.url), JSON.stringify(summary, null, 2));
  assert.equal(spikes, 0);
  assert.ok(maxStepMs < Math.max(12, meanStep * 12));
  assert.ok(minBoom > 5.5, "straight boom " + minBoom);
});

test("visible rocks under the boom cap stay at or under the limit", () => {
  const len = corridor.length_m;
  let capped = 0;
  for (const pace of ["walk", "sprint"]) {
    for (let along = 6; along <= len - 4; along += 4) {
      for (let h = 0; h < 360; h += 15) {
        const row = sweepPose(pace, x0 + along, h);
        for (const hit of row.hits) {
          if (!hit.visible || !(hit.mag > 1.001)) continue;
          const kind = hit.id.split(":")[0];
          if (kind === "ground" || kind === "bolt" || kind.startsWith("horizon")) {
            assert.fail(kind + " " + hit.mag);
          }
          if (kind === "boulder" || kind === "stone") {
            assert.ok(row.boom > BOOM_CAP - 0.08, kind + " over limit with boom " + row.boom);
            capped += 1;
          }
        }
      }
    }
  }
  assert.ok(capped < 40);
});
