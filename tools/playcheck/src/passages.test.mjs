import assert from "node:assert/strict";
import test from "node:test";
import { hitsPassage, passagesFromRuin } from "../../rocks/passages.mjs";

const manifest = {
  collider: { bodyRadiusM: 0.3 },
  objects: [
    {
      id: "gate",
      frame: "gate",
      x: 0,
      z: 0,
      yaw: 0,
      openingBoxM: [-2, 2, 0, 8],
      bounds: { min: [-6, 0, -3], max: [6, 10, 3] },
    },
    {
      id: "wreck",
      frame: "ship",
      x: 0,
      z: 0,
      yaw: 0,
      bounds: { min: [-8, 0, -2], max: [8, 4, 2] },
      hangar: { x: [-2, 2], portZ: 1 },
    },
  ],
};

test("a gate opening and a hangar mouth exclude a disc", () => {
  const passages = passagesFromRuin(manifest);
  assert.equal(passages.length, 2);
  const gate = passages.find((p) => p.kind === "gate");
  const hangar = passages.find((p) => p.kind === "hangar");
  assert.equal(hitsPassage(0, 0, 0.4, [gate]), true);
  assert.equal(hitsPassage(30, 0, 0.4, [gate]), false);
  // Ship yaw 0 maps local (x, z) to world (-z, x). The mouth is local z = portZ.
  assert.equal(hitsPassage(-1, 0, 0.2, [hangar]), true);
  assert.equal(hitsPassage(-1, 30, 0.2, [hangar]), false);
  assert.equal(hitsPassage(0, 0, 1, []), false);
});
