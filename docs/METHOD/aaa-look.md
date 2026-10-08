# AAA look — phone-cheap (priority list)

Back to [METHOD.md](../METHOD.md). **Status: IN TEST (2026-10-08).** §9 ambient life and §10 depth and scale added 2026-10-08 (Grok on X). Living-world cues beat the post stack. On an Android WebGL phone, fill-rate is the budget, so a second fullscreen pass has to earn its place.

**Hard caps when any pass is on:** `renderer.setPixelRatio` ≤ **1.5**, `antialias: false`. Skip SSAO, SSR, DOF, and TAA. Fog plus FOV plus dust already does the depth and the speed. Lighting coherence ([lighting-coherence.md](lighting-coherence.md)) lands first.

## 1. Camera feel — free, do it first

Speed should change the lens, not just the animation. Base FOV **58**, sprint opens it to **70**. Shake is **trauma that decays**, not per-frame noise. A landing spike to 0.35 is enough. Continuous shake at sprint reads as a bug.

```js
const cam = new THREE.PerspectiveCamera(58, w / h, 0.2, 400);
let trauma = 0;
function cameraFeel(dt, speed01) {
  const fov = THREE.MathUtils.lerp(58, 70, speed01 * speed01);
  cam.fov = THREE.MathUtils.damp(cam.fov, fov, 4, dt);
  cam.updateProjectionMatrix();
  trauma = Math.max(0, trauma - dt * 1.6);
  const s = trauma * trauma;
  cam.rotation.z = Math.sin(performance.now() * 0.02) * 0.004 * s;
  cam.position.y += Math.sin(performance.now() * 0.031) * 0.02 * s;
}
// land or boost: trauma = Math.min(1, trauma + 0.35)
```

(Supersedes "no shake ever" only for short decaying trauma on land/boost. Do not run continuous shake.)

## 2. Rotating planet and drifting clouds — free

The planet is its **own sphere** parented to the sky rig, not pixels in the dome (zone B numbers: [sky-sphere](sky-sphere.md)). Spin the sphere, not the camera. Prefer an Imagine still (or keyed plate) mapped on a real sphere + a real ring mesh — green-screen planet video with chroma key eats the dark limb into black bands.

```js
planet.rotation.y += dt * 0.015;          // one turn ≈ 7 min
planetRing.rotation.z += dt * 0.04;
sky.material.map.offset.x += dt * 0.002;   // high cloud layer
sky.material.map.wrapS = THREE.RepeatWrapping;
```

A second cloud shell, slightly larger, offset at `0.0006` the other way, is the difference between a backdrop and weather. No volumetric clouds.

## 3. Dust at Bolt's feet — cheap, high life

One `THREE.Points` draw, 48–96 verts, recycled. Spawn at the back paws when speed is high, tint ground-bounce into the horizon as they rise, kill by 0.6 s. Additive or premul, `depthWrite: false`, no sort. Puff map is Imagine (or a tiny radial atlas), not a code-drawn colour field.

```js
const dust = new THREE.Points(geo, new THREE.PointsMaterial({
  color: 0xc47a68, size: 0.35, map: puffTex,
  transparent: true, depthWrite: false, sizeAttenuation: true
}));
```

That plus the contact blob from [lighting-coherence](lighting-coherence.md) sells weight better than any shadow map.

## 4. Grain and vignette — one cheap pass

One fullscreen triangle, no EffectComposer chain. Grain at **4%** so mesa bands do not posterize, vignette only in the outer **25%**.

```glsl
float v = smoothstep(0.72, 1.15, length(uv - 0.5));
col = mix(col, col * 0.72, v);
float n = fract(sin(dot(gl_FragCoord.xy + frame, vec2(12.9898, 78.233))) * 43758.5453);
col += (n - 0.5) * 0.04;
```

Skip a grain texture. The hash is enough at phone res.

## 5. Texture LOD — cheap, stops the sparkle

Distant Imagine plates shimmering are the cheap tell. Mipmaps on, anisotropy **4** not 16.

```js
tex.generateMipmaps = true;
tex.minFilter = THREE.LinearMipmapLinearFilter;
tex.anisotropy = 4;
tex.magFilter = THREE.LinearFilter;
```

Past the fog start (40 m), swap to a 256 px plate or bias the mip: `texture2D(map, uv, 2.0)`. Do not stream 2048s for mesas already in the horizon colour.

## 6. Sprint blur — moderate, only while sprinting

Not a velocity buffer. Radial zoom blur on a **half-res** target, weight `speed01`, off when walking so the pass can be skipped.

```js
const rt = new THREE.WebGLRenderTarget(w * 0.5, h * 0.5);
// 6–8 taps along (uv - 0.5) * speed01 * 0.012
```

Eight taps at half res is the ceiling. A full-res motion-blur pass is not worth it.

## 7. Tonemap — only if it is the same pass as grain

Plates are already graded to the sky. `ACESFilmic` on top splits them again. Keep `toneMapping = THREE.NoToneMapping`. If the image looks flat, a small contrast in that same grain shader is the whole grade:

```glsl
col = pow(col, vec3(0.95));
col = clamp((col - 0.5) * 1.06 + 0.5, 0.0, 1.0);
```

## 8. Bloom — last, or a sprite

`UnrealBloomPass` is the most expensive item here. If the sun needs a glow, use the additive billboard already on the disc ([lighting-coherence](lighting-coherence.md) §6). If you still want bloom: threshold `0.85`, radius `0.4`, strength `0.25`, at **quarter res**, and **only on the sky target**. Never bloom the cutout plates. Their edges will halo back into stickers.

## 9. Ambient life — three cheap effects (Grok on X, 2026-10-08)

Biggest wow for the lowest cost. Dust gusts already exist. **Skip light shafts.**

| Effect | How | Cost |
|---|---|---|
| **Heat shimmer** | UV warp in the existing grain pass, **horizon band only** (far depth), tiny amplitude (start ~0.002 UV), slow time | ~free, no extra pass |
| **Drifting sand** | ground detail noise scrolled along the wind + sparse low particles (reuse the dust `Points`, ~32–64) | one draw |
| **Birds** | 3–5 birds on slow high orbits. **Tiny 3D Blender meshes** (~200 tris) with a flap (vertex shader or 2-bone), Imagine texture, instanced. **Not billboards** (owner rule: no flat objects). | one instanced draw |

## 10. Depth and scale (Grok on X, 2026-10-08)

Make Ember Mesa feel huge: a 20 m arch and 30 m mesas must read as monumental next to Bolt.

**Fog that densifies and shifts warm (near) → cool (far).** `FogExp2` or the custom fog mix. Start values for Ember Mesa: density **0.0085** (≈11 % at 40 m, ≈94 % at 200 m). Near colour = sampled horizon `#c49c6f` (warm). Mid–far shifts toward the planet fill `#c47ad4`, then returns to the horizon colour where objects are fully fogged, so the skyline does not seam ([lighting-coherence](lighting-coherence.md) §4).

```glsl
float f = 1.0 - exp(-pow(0.0085 * d, 2.0));                              // FogExp2
float cool = 0.30 * smoothstep(40.0, 140.0, d) * (1.0 - smoothstep(180.0, 240.0, d));
vec3 horizon = vec3(0.769, 0.612, 0.435);                                // #c49c6f, sampled
vec3 fogCol = mix(horizon, vec3(0.769, 0.478, 0.831), cool);             // toward #c47ad4
col = mix(col, fogCol, f * mix(1.0, 0.35, smoothstep(2.0, 18.0, worldY)));
```

**Three layers, all real 3D** (start values, tune on the phone):

| Layer | Distance | Content | LOD |
|---|---|---|---|
| Near | 0–40 m | detailed Blender rocks; **Bolt as the scale reference** | full bake, 2–6k tris, 2048 |
| Mid | 40–120 m | mesas, soft haze | mid-poly, ~1.5–3k tris, 1024 |
| Far | 120 m → horizon | hard silhouettes on the horizon | **low-poly 3D LOD of the same Blender bake** (~300–800 tris, 256–512). **Not billboards** (SmiR rule). |

**Size contrast, sparse:** a few huge pieces (30 m mesas, the 20 m arch) against many small rocks (0.5–2 m). Do not fill the mid ground evenly. Keep drawCalls ≤ 12: one instanced or merged draw per LOD family.

## Order of work

1. Lighting coherence (sheet, halo kill, contact, fog, offline grade).
2. Camera FOV + trauma.
3. Planet sphere + cloud scroll.
4. Dust Points + contact blobs.
5. Single grain+vignette pass (`NoToneMapping`).
6. Texture LOD / mip bias past fog.
7. Sprint radial blur (sprint only).
8. Bloom last (sky only) or skip for the sun sprite.
9. Ambient life: heat shimmer, drifting sand, 3D birds (§9).
10. Depth: warm→cool FogExp2 + three 3D LOD layers + sparse size contrast (§10).

## Skip list (always)

SSAO · SSR · DOF · TAA · light shafts · billboard birds / far billboards · full-res motion blur · runtime 3D LUT · cascading shadow maps · bloom on cutouts · `antialias: true` with any post pass · pixel ratio above 1.5.

Related: [lighting-coherence](lighting-coherence.md) · [blender-imagine-bake](blender-imagine-bake.md) · [sky-sphere](sky-sphere.md) · [sky-video-layers](sky-video-layers.md) · [hard-objects](hard-objects.md).
