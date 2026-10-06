import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createFlow } from "../../../biome/scripts/zone-flow/zoneFlow.mjs";
import { FOG_FAR, GROUND_AHEAD } from "./ground.js";
import { TURN_DPS, holdBody, wrap360 } from "./look.js";
import { HORIZON_NEAR, createField, stepField } from "./stream.js";

const world = JSON.parse(readFileSync(new URL("../world.json", import.meta.url), "utf8"));
const layout = JSON.parse(readFileSync(new URL("../path-layout.json", import.meta.url), "utf8"));
const zones = {};
for (const [id, listed] of Object.entries(world.zones)) {
  const name = listed.split("/").pop();
  zones[id] = JSON.parse(readFileSync(new URL("../" + name, import.meta.url), "utf8"));
}

function sprint(turnOf) {
  const flow = createFlow(world, { zones });
  const corridor = layout.corridors[0];
  const start = zones[world.start].spawn;
  const x0 = corridor.waypoints[0][0];
  const xEnd = corridor.waypoints[corridor.waypoints.length - 1][0];
  const pathZ = corridor.waypoints[0][1];
  let x = start.position[0];
  let z = start.position[1];
  let heading = start.heading_deg;
  let prevMode = "zone";
  const field = createField({ seed: layout.seed || 1, x0, pathZ });
  const dt = 1 / 30;
  const steps = Math.round(120 / dt);
  let prevX = x;
  let prevZ = z;
  let prevLive = 0;
  let maxDrop = 0;
  let minLive = Infinity;
  let handed = false;
  for (let i = 0; i < steps; i++) {
    const t = i * dt;
    const turn = turnOf(t);
    heading = wrap360(heading + turn * TURN_DPS * dt);
    const before = field.live;
    stepField(field, { x, z, heading, forward: 1, gallop: true }, dt);
    if (i > 90) {
      const drop = before - field.live;
      if (drop > maxDrop) maxDrop = drop;
      if (field.live < minLive) minLive = field.live;
    }
    const yaw = heading * Math.PI / 180;
    x += Math.sin(yaw) * field.speed * dt;
    z += Math.cos(yaw) * field.speed * dt;
    const onPath = Math.abs(z - pathZ) < 8 && x > x0 - 4 && x < xEnd + 4;
    const along = Math.sin(heading * Math.PI / 180) * field.speed;
    const walk = onPath && along > 0.2 ? along : 0;
    const sample = flow.step({
      dt, x, z, heading, speed: walk, hitchMs: dt * 1000, black: false,
    });
    const held = holdBody({ x, z, heading }, sample, prevMode, zones, world.start);
    x = held.x;
    z = held.z;
    heading = held.heading;
    const jump = Math.hypot(x - prevX, z - prevZ);
    const allow = field.speed * dt * 1.5;
    assert.ok(jump <= allow + 1e-4, "jump " + jump.toFixed(3) + " allow " + allow.toFixed(3) + " t " + t.toFixed(1));
    prevX = x;
    prevZ = z;
    prevMode = sample.mode;
    if (sample.mode === "zone" && sample.zoneId && sample.zoneId !== world.start) handed = true;
    prevLive = field.live;
  }
  return { maxDrop, minLive, handed, x, live: prevLive, speed: field.speed };
}

test("a 120 s straight sprint does not teleport or empty the field", () => {
  const run = sprint(() => 0);
  assert.equal(run.handed, true);
  assert.ok(run.minLive > 0, "min live " + run.minLive);
  assert.ok(run.maxDrop <= 4, "drop " + run.maxDrop);
  assert.ok(run.x > 400, "x " + run.x);
});

test("a 120 s sprint with turns does not teleport or empty the field", () => {
  const run = sprint((t) => (t < 3 ? 0 : Math.sin(t * 0.7) * 0.35));
  assert.ok(run.minLive > 0, "min live " + run.minLive);
  assert.ok(run.maxDrop <= 4, "drop " + run.maxDrop);
});

test("the play page keeps the body and does not start a quest on the plain URL", () => {
  const play = readFileSync(new URL("./play.js", import.meta.url), "utf8");
  assert.match(play, /holdBody\(/);
  assert.equal(play.includes("gate.position"), false);
  assert.match(play, /params\.get\("adventure"\) === "1"/);
  assert.match(play, /forkBatch\(/);
});

test("ground fog finishes before the horizon hulls and the quad edge", () => {
  assert.ok(FOG_FAR < HORIZON_NEAR);
  assert.ok(HORIZON_NEAR < GROUND_AHEAD);
  const play = readFileSync(new URL("./play.js", import.meta.url), "utf8");
  assert.match(play, /smoothstep\(\$\{FOG_NEAR/);
});
