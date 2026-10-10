// Lossless fill / bandwidth savings for the Zone B ground (docs/METHOD/phone-perf.md, step 8). Both are A/B-proven
// bit-identical (8 poses at 1.5/3/8/30 m, max diff 0); keep them as switches until the phone bench v4 shows a gain.

/** R8 DataArrayTexture holding the height channel (byte 2 of every RGBA8 texel) of the ground normal array: same size,
 *  layers, wrap, mips and anisotropy. POM reads it instead of the RGBA8 array: 1/4 of the bytes per read. */
export function createHeightArray(THREE, normalBytes, size, layers, anisotropy = 1) {
  const n = size * size * layers, h = new Uint8Array(n);
  for (let i = 0; i < n; i++) h[i] = normalBytes[i * 4 + 2];
  const t = new THREE.DataArrayTexture(h, size, size, layers);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType; t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = anisotropy; t.needsUpdate = true;
  return t;
}

/** Switch the ground material's POM height reads to the R8 copy (#define G_HR8 in biome-ground.js), or back. */
export function setHeightR8(material, heightTex, on) {
  const d = { ...(material.defines || {}) };
  if (on) { d.G_HR8 = 1; material.uniforms.uGroundH = { value: heightTex }; } else delete d.G_HR8;
  material.defines = d; material.needsUpdate = true;
}

/** Depth-only twin of the ground mesh (the ground's own vertex code, so depths match exactly; colour writes off), drawn just
 *  before it. The merged terrain mesh is in row-major cell order, so half of the view directions draw it back to front; with
 *  the prepass every ground pixel runs the expensive fragment shader once. Cost: terrain vertices twice. The twin always uses
 *  the ground's current geometry (no one-frame lag when the terrain streams). Add it to the scene; toggle .visible.
 *  The ground must keep depthFunc LessEqual. */
export function createGroundPrepass(THREE, ground, renderOrder = (ground.renderOrder || 0) - 0.5) {
  const pre = new THREE.Mesh(ground.geometry, new THREE.ShaderMaterial({
    glslVersion: ground.material.glslVersion, vertexShader: ground.material.vertexShader,
    fragmentShader: "void main() {}", colorWrite: false, side: ground.material.side }));
  pre.frustumCulled = false; pre.renderOrder = renderOrder; pre.name = "ground-prepass";
  Object.defineProperty(pre, "geometry", { get: () => ground.geometry, set: () => {}, configurable: true });
  return pre;
}
