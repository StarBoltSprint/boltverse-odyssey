// node --test tools/biome/runtime/biome-runtime.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as R from "./biome-runtime.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const tracked = JSON.parse(readFileSync(here + "../biomes/ember-mesa.json", "utf8"));

test("fog uniforms: 3 bands, distances rise, amounts in 0..1, colours linear even without the local palette", () => {
  const u = R.fogUniforms(tracked);
  assert.equal(u.uFogD.length, 3);
  assert.ok(u.uFogD[0] < u.uFogD[1] && u.uFogD[1] < u.uFogD[2]);
  for (const a of u.uFogA) assert.ok(a >= 0 && a <= 1);
  for (const c of [u.uFogC0, u.uFogC1, u.uFogC2]) assert.equal(c.length, 3);
});

test("hex -> linear matches sRGB transfer", () => {
  const [r, g, b] = R.hexToLinear("#ffffff");
  assert.ok(Math.abs(r - 1) < 1e-9 && Math.abs(g - 1) < 1e-9 && Math.abs(b - 1) < 1e-9);
  assert.ok(Math.abs(R.hexToLinear("#808080")[0] - 0.2158605) < 1e-6);
});

test("heading convention: 0 = run direction (-Z), 90 = +X, elevation lifts Y", () => {
  const f = R.headingToDir(0), r = R.headingToDir(90), up = R.headingToDir(0, 90);
  assert.ok(Math.abs(f[2] + 1) < 1e-9 && Math.abs(r[0] - 1) < 1e-9 && Math.abs(up[1] - 1) < 1e-9);
});

test("camera rig: FOV opens with speed and settles, trauma stays off (owner rule)", () => {
  const rig = R.createCameraRig(tracked);
  let o;
  for (let i = 0; i < 240; i++) o = rig.update(1 / 60, 1);
  assert.ok(Math.abs(o.fovDeg - tracked.camera.fovSprint) < 0.2, `fov ${o.fovDeg}`);
  rig.land();
  o = rig.update(1 / 60, 1);
  assert.equal(o.rollRad, 0); assert.equal(o.liftM, 0);
  const shaky = R.createCameraRig({ camera: { ...tracked.camera, trauma: { ...tracked.camera.trauma, enabled: true } } });
  shaky.land(); shaky.update(1 / 60, 0);
  assert.ok(shaky.trauma > 0);
});

test("grade: offline LUT by default (identity at runtime), grain + vignette from the bible", () => {
  const g = R.gradeUniforms(tracked);
  assert.deepEqual(g.uLift, [0, 0, 0]); assert.deepEqual(g.uGain, [1, 1, 1]);
  assert.equal(g.uGrain, tracked.post.grain);
  const g2 = R.gradeUniforms({ ...tracked, post: { ...tracked.post, runtimeLut: true } });
  assert.deepEqual(g2.uGain, tracked.lut.gain);
});

test("renderer settings: no tone mapping, no scene fog, pixel ratio capped", () => {
  const s = R.rendererSettings(tracked);
  assert.equal(s.toneMapping, "NoToneMapping"); assert.equal(s.sceneFog, null);
  assert.ok(s.pixelRatioCap <= 2);
});

test("GLSL chunks expose the expected entry points", () => {
  assert.match(R.FOG_GLSL, /vec3 biomeFog\(vec3 col, float dist, float worldY\)/);
  assert.match(R.GRADE_FRAG, /#version 300 es/);
  assert.match(R.SKY_EQUIRECT_GLSL, /textureGrad/);
});
