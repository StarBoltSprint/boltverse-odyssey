import assert from "node:assert/strict";
import { test } from "node:test";
import { createLook, pushLook, stepLook } from "./look.js";

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
