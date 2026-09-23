# gpu-openable — law 38 runtime

Doors, chests, generators, and crystal hatches. Imagine cooks closed / open / transition (and an optional content bib). GPU owns the hit, the anim, the LOD band, and the content spawn. Opening is never painted into densify.

| File | Role |
|---|---|
| [`gpuOpenable.js`](gpuOpenable.js) | `openableState` · `openableFrame` · `openableHit` · `openableOpen` · `openableClose` · `openableBib` · `assertOpenableNative` |
| [`demo.js`](demo.js) | `node demo.js` — hit, transition, content, generator light cue |

Law: [`../../docs/38-gpu-light-openable.md`](../../docs/38-gpu-light-openable.md)  
Brief: [`../../docs/COLD_START-gpu-light-openable.md`](../../docs/COLD_START-gpu-light-openable.md)  
Cone: [`../howl-live/howlLive.js`](../howl-live/howlLive.js) (`howlPose`)  
Bands: [`../lena-lod/lenaLod.js`](../lena-lod/lenaLod.js) (`objectBand`)  
Light cue target: [`../gpu-light/gpuLight.js`](../gpu-light/gpuLight.js) (`lightLayerFrame`)

## Wire (Build)

1. Cook densify Video A as one clean 3-lane loop (first + last). **GPU is REQUIRED.** **FAIL** if you paint a door, chest, generator, hatch, or its open state into Video A.
2. Cook three keyed state bibs per prop (`closed`, `open`, `transition`) at `openableBib`. Optional content at `contentBib`. Same world as the plate. Not a densify crop.
3. Copy `gpuOpenable.js` into Live next to `howlLive.js`. Call `openableFrame` every frame. `openableHit` then `openableOpen` / `openableClose`.
4. Draw `bib` on `pose.dest`. Draw `content.bib` when `content.visible`. Far band is not hittable. Shadow only when `contact` (near).
5. Pass `frame.lightCues` into `lightLayerFrame` as `set` when a generator names `lightId`. The beam stays a light layer. `glossOverlay` on that light is the fake interactive reflect (graded from the plate, zero bounces). The bibs themselves already look path-traced. True RT is the UE rail, HOLD.
6. `assertOpenableNative(frame)` must be `[]`. `paintedOpen`, `hud`, and `bakeIntoDensify` stay false. `gpu` stays true.

`bash biome/scripts/biome-cook/biome-cook.sh openable`
