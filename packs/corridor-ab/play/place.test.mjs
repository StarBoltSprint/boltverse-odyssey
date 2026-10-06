import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { cellCenter, gateMouth, poseOnCorridor } from "./place.js";

const root = new URL("../", import.meta.url);
const world = JSON.parse(readFileSync(new URL("./world.json", root), "utf8"));
const layout = JSON.parse(readFileSync(new URL("./path-layout.json", root), "utf8"));

function loadZone(id) {
  const listed = world.zones[id];
  const name = listed.split("/").pop();
  return JSON.parse(readFileSync(new URL(`./${name}`, root), "utf8"));
}

test("hung corridors match the layout and stay load-time", () => {
  assert.equal(world.when, "load");
  assert.equal(world.draws_pixels, false);
  assert.equal(layout.when, "load");
  assert.equal(layout.draws_pixels, false);
  assert.deepEqual(world.corridors, layout.world_corridors);
  assert.equal(world.corridors.length, 1);
  assert.equal("waypoints" in world.corridors[0], false);
  assert.ok(layout.corridors[0].waypoints.length > 2);
});

test("gate mouths sit on the waypoints and leads_to is the corridor", () => {
  const corridor = layout.corridors[0];
  const record = world.corridors[0];
  const pairs = [
    [record.from.zone, corridor.waypoints[0]],
    [record.to.zone, corridor.waypoints[corridor.waypoints.length - 1]],
  ];
  for (const [zoneId, waypoint] of pairs) {
    const clearing = loadZone(zoneId);
    const gate = clearing.gates[0];
    const hit = gateMouth(clearing.zone.center, gate.heading_deg, clearing.edge_ring.radius_m);
    assert.ok(Math.abs(hit.x - waypoint[0]) < 1e-4, `${zoneId} x`);
    assert.ok(Math.abs(hit.z - waypoint[1]) < 1e-4, `${zoneId} z`);
    const centre = cellCenter(gate.id === "out" ? 0 : 11, 1, layout.grid.tile_m);
    assert.ok(Math.abs(centre[0] - waypoint[0]) < 1e-6);
    assert.ok(Math.abs(centre[1] - waypoint[1]) < 1e-6);
  }
  const origin = loadZone(record.from.zone);
  assert.equal(origin.gates[0].leads_to, record.id);
});

test("Bolt's pose walks the waypoint segment", () => {
  const corridor = layout.corridors[0];
  const start = poseOnCorridor(corridor.waypoints, corridor.length_m, 0);
  const end = poseOnCorridor(corridor.waypoints, corridor.length_m, corridor.length_m);
  const mid = poseOnCorridor(corridor.waypoints, corridor.length_m, corridor.length_m * 0.5);
  assert.ok(Math.abs(start.x - corridor.waypoints[0][0]) < 1e-6);
  assert.ok(Math.abs(end.x - corridor.waypoints.at(-1)[0]) < 1e-6);
  assert.ok(mid.x > start.x && mid.x < end.x);
  assert.ok(Math.abs(mid.heading - 90) < 1e-6);
});
