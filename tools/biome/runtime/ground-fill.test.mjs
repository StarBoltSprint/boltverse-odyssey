// node --test tools/biome/runtime/ground-fill.test.mjs (stub THREE: checks bytes and wiring, not GPU output; the GPU proof is
// tools/perf/phone-bench/ab-identity.mjs <url> <out> fill)
import test from "node:test";
import assert from "node:assert/strict";
import { createHeightArray, setHeightR8, createGroundPrepass } from "./ground-fill.mjs";

class DataArrayTexture { constructor(d, w, h, l) { Object.assign(this, { image: { data: d, width: w, height: h, depth: l } }); } }
class ShaderMaterial { constructor(o) { Object.assign(this, o); } }
class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
const THREE = { DataArrayTexture, ShaderMaterial, Mesh, RedFormat: "R", UnsignedByteType: "U8", NoColorSpace: "", RepeatWrapping: 1, LinearFilter: 2, LinearMipmapLinearFilter: 3 };

test("height array copies byte 2 of every texel, exactly", () => {
  const size = 4, layers = 2, src = new Uint8Array(size * size * layers * 4);
  for (let i = 0; i < src.length; i++) src[i] = (i * 37 + 11) & 255;
  const t = createHeightArray(THREE, src, size, layers, 16);
  assert.equal(t.image.data.length, size * size * layers);
  for (let i = 0; i < t.image.data.length; i++) assert.equal(t.image.data[i], src[i * 4 + 2]);
  assert.equal(t.format, "R"); assert.equal(t.anisotropy, 16); assert.equal(t.generateMipmaps, true);
});
test("setHeightR8 toggles the define and binds the texture", () => {
  const m = { defines: { G_OLDPOM: 1 }, uniforms: {} }, tex = {};
  setHeightR8(m, tex, true); assert.equal(m.defines.G_HR8, 1); assert.equal(m.uniforms.uGroundH.value, tex); assert.equal(m.defines.G_OLDPOM, 1);
  setHeightR8(m, tex, false); assert.equal("G_HR8" in m.defines, false); assert.equal(m.needsUpdate, true);
});
test("prepass follows the ground's current geometry and draws depth only, before it", () => {
  const ground = { geometry: { id: 1 }, renderOrder: 1, material: { glslVersion: "300 es", vertexShader: "VS", side: 0 } };
  const pre = createGroundPrepass(THREE, ground);
  assert.equal(pre.material.colorWrite, false); assert.equal(pre.material.vertexShader, "VS"); assert.equal(pre.renderOrder, 0.5);
  ground.geometry = { id: 2 }; assert.equal(pre.geometry.id, 2);
});
