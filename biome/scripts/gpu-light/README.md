# gpu-light — law 38 runtime

Playable lights are keyed plates of **only** light (beam, glow, neon, flash) on black or transparent. Densify keeps base ambience. This folder does not bake a beam into Video A and does not build a second cone.

| File | Role |
|---|---|
| [`gpuLight.js`](gpuLight.js) | `lightLayerState` · `lightLayerFrame` · `lightBib` · `fadeIntensity` · `parseTint` · `assertLightNative` |
| [`demo.js`](demo.js) | `node demo.js` — fade 0→1, tint, cone, native locks |

Law: [`../../docs/38-gpu-light-openable.md`](../../docs/38-gpu-light-openable.md)  
Brief: [`../../docs/COLD_START-gpu-light-openable.md`](../../docs/COLD_START-gpu-light-openable.md)  
Cone: [`../howl-live/howlLive.js`](../howl-live/howlLive.js) (`howlPose`)  
Bands: [`../lena-lod/lenaLod.js`](../lena-lod/lenaLod.js) (`objectBand`)  
Openables that cue a lamp: [`../gpu-openable/gpuOpenable.js`](../gpu-openable/gpuOpenable.js)

## Wire (Build)

1. Cook densify Video A as one clean 3-lane loop (first + last). **GPU is REQUIRED.** **FAIL** if you paint a beam, glow, neon, or flash into Video A. Law 31 ambience stays on that plate.
2. Cook the light-only Imagine at `lightBib(kind, noun)` — black key, no road, no dog.
3. Copy `gpuLight.js` into Live next to `howlLive.js`. Call `lightLayerFrame` every frame on the densify clock.
4. Draw layers with `draw === true` on `pose.dest`. Multiply by `intensity` and `tint`. Where `glossOverlay` draws, composite that quad on the same dest. `gradeFromPlate`. `bounces` stays 0. Not a HUD. Not a raytracer. `rtLook` is `baked-imagine`. True RT is the UE rail, HOLD.
5. `assertLightNative(frame)` must be `[]`. `tileDensify` and `hud` stay false. `bakeIntoDensify` stays false. `gpu` stays true.

`bash biome/scripts/biome-cook/biome-cook.sh light`
