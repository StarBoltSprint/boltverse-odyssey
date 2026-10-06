import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { localXZ, placeProps, pushDiscs } from "./scatter.js";

const layout = JSON.parse(readFileSync(new URL("../path-layout.json", import.meta.url), "utf8"));
const ruins = JSON.parse(readFileSync(new URL("../../zone-a/src/ruins/manifest.json", import.meta.url), "utf8"));
const corridor = layout.corridors[0];

function placed() {
  return placeProps({
    seed: layout.seed,
    waypoints: corridor.waypoints,
    lengthM: corridor.length_m,
  });
}

test("the same seed places the same props", () => {
  assert.deepEqual(placed(), placed());
});

test("a second seed moves the scatter", () => {
  const a = placed();
  const b = placeProps({ seed: layout.seed + 1, waypoints: corridor.waypoints, lengthM: corridor.length_m });
  const moved = a.rocks.some((rock, i) => rock.x !== b.rocks[i].x || rock.z !== b.rocks[i].z);
  assert.equal(moved, true);
  assert.notEqual(a.monuments.arch.x, b.monuments.arch.x);
});

test("the arch opening faces the run and a pier is off the centre line", () => {
  const props = placed();
  const arch = ruins.objects.find((obj) => obj.id === "arch");
  const seat = props.monuments.arch;
  const centre = localXZ("gate", seat.yaw, seat.x, seat.z, seat.x + 1, seat.z);
  const [x0, x1] = arch.openingBoxM;
  assert.ok(centre.x > x0 && centre.x < x1);
  const pier = localXZ("gate", seat.yaw, seat.x, seat.z, seat.x, seat.z + 1.8);
  assert.ok(pier.x < x0 || pier.x > x1);
});

test("the gate opening faces the run", () => {
  const props = placed();
  const gate = ruins.objects.find((obj) => obj.id === "gate");
  const seat = props.monuments.gate;
  const centre = localXZ("gate", seat.yaw, seat.x, seat.z, seat.x + 1, seat.z);
  const [x0, x1] = gate.openingBoxM;
  assert.ok(centre.x > x0 && centre.x < x1);
});

test("the wreck sits off the path and a rock footprint stops a body", () => {
  const props = placed();
  assert.ok(Math.abs(props.monuments.wreck.z - props.pathZ) > 8);
  const rock = props.rocks[0];
  const pushed = pushDiscs(rock.x, rock.z, [{ x: rock.x, z: rock.z, r: rock.r }], 0.3);
  assert.ok(Math.hypot(pushed.x - rock.x, pushed.z - rock.z) >= rock.r + 0.3 - 1e-6);
  const clear = pushDiscs(rock.x + rock.r + 2, rock.z, [{ x: rock.x, z: rock.z, r: rock.r }], 0.3);
  assert.equal(clear.contact, false);
});
