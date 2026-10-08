# Lighting coherence — one light sheet per zone

Back to [METHOD.md](../METHOD.md). **Status: IN TEST (2026-10-08).** Owner asked Grok for a sticker-kill recipe; this page is that rule set. Same force as other IN TEST recipes until phone validation.

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

The horizon hex has to be the **same number** on the sky plate and in fog. Ember Mesa: `#e8a0b4`. Height-weighted, so the feet of a mesa melt in and the crown stays sharper.

```js
scene.fog = new THREE.Fog(0xe8a0b4, 40, 220);
```

If the cutout shader is custom, one mix is enough:

```glsl
float h = smoothstep(2.0, 18.0, worldPos.y);
float d = smoothstep(40.0, 220.0, length(worldPos.xz));
vec3 col = mix(base, vec3(0.910, 0.627, 0.706), d * mix(1.0, 0.35, h));
```

Near objects stay plate-colored. Far mesas become the sky. That is the depth you are missing.

**Sky, ground, and the fog uniform share `#e8a0b4` exactly.** If the ground plate has a different horizon, the seam at the sky line puts the stickers back.

## 5. Grade once, offline (do not LUT at runtime)

Pick the sky dome as the master. Grade every other plate to it with one lift / gamma / gain, then bake. Runtime stays `NoToneMapping`, or the sky and the plates get graded twice and split again.

Ember Mesa grade, applied to every non-sky plate: lift the blacks toward plum `rgb(30, 10, 28)`, gamma about `1.05`, gain pulled slightly toward `#e8a0b4`. Shadows never land on 0. A 16³ LUT baked into the PNG is fine. A runtime 3D LUT is not worth it on an unlit phone scene.

## 6. Only after the above

- Ambient is already in the plate if the sheet was in the prompt. A `HemisphereLight` on unlit meshes does nothing. **Do not add one.**
- **Rim:** bake it. In the bleed step, tint the outer 2 px toward the key `#ffb089` on the sun side and `#c47ad4` on the planet side. A view-dependent rim in the shader costs a varyings-and-normalize on every cutout for a smaller win.
- **Sun glare:** one additive billboard on the sun disc, tint `#ffb089`, no post stack. Full-screen bloom is the first thing to drop.

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

Related: [hard-objects](hard-objects.md) · [giant-arch](giant-arch.md) · [aaa-look](aaa-look.md) · [sky](sky.md) · [ground](ground.md).
