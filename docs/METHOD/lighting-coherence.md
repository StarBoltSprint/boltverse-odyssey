# Lighting coherence — one light sheet per zone

Back to [METHOD.md](../METHOD.md). **Status: IN TEST (2026-10-08).** Owner asked Grok for a sticker-kill recipe; this page is that rule set. Same force as other IN TEST recipes until phone validation. **Updated 2026-10-08** with Grok on X additions (locked sun vector, exposure/WB, master LUT, cast shadows) and the three-stage rule (§8). Automation: [biome-pipeline](biome-pipeline.md).

The sticker look is the black matte showing through the cutout edge, plus plates lit by a studio key while the sky is a pink-violet sunset. Fix those two and the zone reads as one place. Shadow maps, bloom, and a runtime LUT are the expensive end. **Skip them.**

Do this in order. The first three are most of the win.

## 1. Kill the black halo (biggest win, free at runtime)

Imagine plates are painted on black. Bilinear filtering pulls that black into the edge, and a straight-alpha blend does it again. Two offline steps, then premul in the material.

**Bleed:** for every pixel with alpha under about 0.95, copy the nearest opaque color out **2–4 px** and leave the alpha as it was. Then premultiply, `rgb *= a`. Pack that. **Do not premultiply twice.**

```js
const tex = new THREE.TextureLoader().load(url);
tex.colorSpace = THREE.SRGBColorSpace;
tex.premultiplyAlpha = true;
tex.minFilter = THREE.LinearMipmapLinearFilter;
tex.generateMipmaps = true;

const cutout = new THREE.MeshBasicMaterial({
  map: tex,
  transparent: true,
  premultipliedAlpha: true,
  depthWrite: true,
  alphaTest: 0.04
});
renderer = new THREE.WebGLRenderer({ antialias: false, premultipliedAlpha: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
```

`alphaTest` only drops the dead fringe. The visible edge is the bled color, so it should be the rim color from the light sheet, not black and not a drawn outline. **`MeshBasicMaterial` on purpose:** these plates already contain their light. A Lambert or Phong on top of a sunset plate is a second sun.

Use Grok Build 1.0.50+ cutout path so PNG transparency is preserved. Re-importing an old atlas cut before that version keeps the black fringe — **recook or re-bleed**, do not ship it.

## 2. One light sheet in every Imagine prompt (zero runtime cost)

Same line on the sky dome, the ground, and every cutout. Store the zone sheet and **paste it unchanged**. Do not invent a second sun per plate.

### Worked example — Ember Mesa (locked reference pattern)

> light sheet: sunset on Ember Mesa, sun low at the right, 8 degrees above the horizon, key salmon #ffb089, fill from the left sky and the ringed planet is pink-violet #c47ad4, shadows plum #4a2048 never black, horizon haze dusty rose #e8a0b4, zenith indigo #3a2468, ground bounce warm rust #a85a48, no studio softbox, no noon sun, no neutral white, no black background fringe

### 2b. Lock the numbers, word for word (Grok on X, 2026-10-08)

The sheet must be **numeric and identical** in every prompt (sky, ground, mesas, rocks, Anchor), so every shadow lands in the same place with the same colour:

- **Sun vector:** azimuth + elevation **8°** + intensity, same words every time. Azimuth is read once from the sun disc in the 2:1 sky plate (`azimuth = (u − 0.5) × 360°`, u = disc x / width) and then never changes.
- **Exposure and white balance (colour temperature, K):** the same numbers in every prompt (values live in `biome.json`, sun group; still to be fixed for Ember Mesa).
- **Ambient fill:** say it (fill from the left sky / planet #c47ad4) so the plum shadows never go pure black.
- Source of truth: one `biome.json` per biome; a generator pastes it ([biome-pipeline](biome-pipeline.md)). Nobody retypes the sheet by hand.

Other biomes get their own sheet (kit + untracked `*.local.md`). The sheet above is the Ember Mesa pattern to copy structurally. Plates cooked with upper-left studio light on black **keep reading as stickers** until they are recooked with this line.

## 3. Contact without a shadow map (one batched draw)

A plum blob on a ground quad, not a projected shadow. One shared radial texture, one instanced mesh, `polygonOffset` so it does not z-fight. Color is the sheet shadow `#4a2048` at about **0.45**, scaled to the footprint, flattened on Y. A wolf-sized blob under a 20 m arch is enough. Skip cascades.

```js
const blob = new THREE.MeshBasicMaterial({
  map: contactTex,
  color: 0x4a2048,
  transparent: true,
  premultipliedAlpha: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1
});
// quad in the XZ plane, y = ground + 0.03, scale.xz = footprint
```

## 4. Haze toward the horizon color (almost free)

The horizon hex has to be the **same number** on the sky plate and in fog, **sampled** from the sky plate's horizon band, never typed. Ember Mesa sample (2026-10-08): **`#c49c6f`**. `#e8a0b4` stays the haze colour in the prompt line; the earlier draft of this page used it as the fog value. Height-weighted, so the feet of a mesa melt in and the crown stays sharper.

```js
scene.fog = new THREE.Fog(0xc49c6f, 40, 220);   // Ember Mesa sampled horizon; warm→cool variant: aaa-look §10
```

If the cutout shader is custom, one mix is enough:

```glsl
float h = smoothstep(2.0, 18.0, worldPos.y);
float d = smoothstep(40.0, 220.0, length(worldPos.xz));
vec3 col = mix(base, vec3(0.769, 0.612, 0.435), d * mix(1.0, 0.35, h));   // #c49c6f
```

Near objects stay plate-colored. Far mesas become the sky. That is the depth you are missing.

**Sky, ground, and the fog uniform share the sampled horizon (`#c49c6f` for Ember Mesa) exactly.** If the ground plate has a different horizon, the seam at the sky line puts the stickers back.

## 5. One master LUT, offline (do not LUT at runtime)

Pick the sky dome as the master. Build **one master LUT** per biome from it and apply that same file to **all** plates: sky, ground, object views, and the baked Blender textures. Then bake. Grain is uniform across the frame (one pass, 0.04, [aaa-look](aaa-look.md) §4). Runtime stays `NoToneMapping`, or the sky and the plates get graded twice and split again.

Ember Mesa grade, applied to every non-sky plate: lift the blacks toward plum `rgb(30, 10, 28)`, gamma about `1.05`, gain pulled slightly toward `#e8a0b4`. Shadows never land on 0. A 16³ LUT baked into the PNG is fine. A runtime 3D LUT is not worth it on an unlit phone scene.

## 6. Only after the above

- Ambient is already in the plate if the sheet was in the prompt. A `HemisphereLight` on unlit meshes does nothing. **Do not add one.**
- **Rim:** bake it. In the bleed step, tint the outer 2 px toward the key `#ffb089` on the sun side and `#c47ad4` on the planet side. A view-dependent rim in the shader costs a varyings-and-normalize on every cutout for a smaller win.
- **Sun glare:** one additive billboard on the sun disc, tint `#ffb089`, no post stack. Full-screen bloom is the first thing to drop.

## 7. Fake cast shadows (decals, not shadow maps)

With a sun 8° up, real shadows are long. The plum contact blob alone is not enough (Grok on X, 2026-10-08).

- Every big object gets a **soft cast-shadow decal** on the ground, **long**, pointing **away from the sun** (sun low right → shadow toward the left), in addition to the contact blob `#4a2048` @ **0.45**.
- Decal shape = the object's own silhouette projected along the locked sun vector, baked once (Blender) as an alpha mask. Tint `#4a2048`, soft edge, fading with length. Same instanced draw as the blobs, `depthWrite: false`, `polygonOffset`.
- Decals also fall between and behind objects (a mesa shadow over the rocks near it).
- Still no shadow maps.

## 8. Three stages — where light lives

1. **Imagine prompts** decide the light (locked sun vector, exposure/WB, plum shadows, ambient fill). Most important.
2. **Blender** keeps it: emission bake, applies the master LUT, **adds no light** ([blender-imagine-bake](blender-imagine-bake.md)).
3. **three.js** adds only position-dependent things: distance fog = sampled horizon (Ember Mesa `#c49c6f`), contact + cast shadows, grain. Everything stays unlit.

## 9. Blending a real 3D object into the scene

No edge blur. A baked 3D object has no cut edge to blend; its outline is its shape. Use:
- **distance fog** toward the horizon colour;
- **buried foot**: sunk into the ground (`--bury`), sand over the base, plum contact + cast shadow;
- **baked rim tint**: `#ffb089` on the sun side, `#c47ad4` on the planet side, baked into the texture.

Old flat cutouts needed edge pixel blending. They are being removed (owner rule 2026-10-08, no flat objects).

## What NOT to do

| Ban | Why |
|---|---|
| Shadow maps / cascades | Fill-rate killer; contact blob is enough |
| Runtime 3D LUT / ACESFilmic on top of graded plates | Double-grades sky vs cutouts → stickers again |
| Lambert / Phong / HemisphereLight on Imagine plates | Second sun |
| Studio softbox / noon / neutral white in prompts | Breaks the sheet |
| Black background fringe left in the atlas | Black halo on every mip |
| Full-screen bloom on cutout plates | Edges halo back into stickers |
| Different horizon hex on sky vs fog vs ground | Skyline seam |
| A different sun angle or exposure per plate | Shadows disagree → collage |
| Edge blur / feather on a baked 3D object | Looks pasted; use fog + buried foot + rim |
| Short round shadow only, under an 8° sun | Reads as studio; add the long cast decal |

## Grok Build checklist — object not done until all pass

Before calling a cutout / solid / mesa / arch plate **done**:

1. [ ] Zone light sheet pasted **unchanged** into every Imagine prompt for that object (sky, ground, and cutouts share one sheet).
2. [ ] Offline edge bleed 2–4 px + **one** premultiply; atlas has no black fringe under mips.
3. [ ] Material is unlit (`MeshBasicMaterial`), `premultipliedAlpha: true`, `alphaTest` ~0.04, renderer `NoToneMapping` + sRGB.
4. [ ] Contact shadow blob present (instanced, sheet shadow colour ~0.45), footprint scaled, no z-fight.
5. [ ] Fog colour equals sky horizon hex exactly; far plates melt toward that colour (height-weighted).
6. [ ] Non-sky plates offline-graded to the sky master (lift / gamma / gain); no runtime tonemap.
7. [ ] Rim tint baked in bleed (key side + fill/planet side); sun glare is a sprite, not bloom on plates.
8. [ ] Phone proof: no black outline around silhouettes; object does not read as a sticker against the sky.
9. [ ] Sun vector (azimuth, 8° elevation, intensity) and exposure/WB numbers identical in every prompt.
10. [ ] Same master LUT on sky, ground, object views and baked textures.
11. [ ] Long soft cast-shadow decal toward the left (away from the sun) on every big object.

Related: [blender-imagine-bake](blender-imagine-bake.md) · [biome-pipeline](biome-pipeline.md) · [sky-sphere](sky-sphere.md) · [hard-objects](hard-objects.md) · [giant-arch](giant-arch.md) · [aaa-look](aaa-look.md) · [sky](sky.md) · [ground](ground.md).
