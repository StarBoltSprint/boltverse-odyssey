# path-beat — law 37 runtime

The chemin reveals one target lane about **3 seconds** before contact. Densify stays one continuous loop. This folder does not slice Video A and does not build a second cone.

| File | Role |
|---|---|
| [`pathBeat.js`](pathBeat.js) | `pathBeatState` · `pathBeatFrame` · `pathBeatChart` · `pathRevealHook` · `pickPathLane` · `pathBeatResolve` · `assertPathNative` |
| [`demo.js`](demo.js) | `node demo.js` — lookahead, L/C/R, hit/miss, native-to-video locks |

Law: [`../../docs/37-path-beat.md`](../../docs/37-path-beat.md)  
Brief: [`../../docs/COLD_START-path-beat.md`](../../docs/COLD_START-path-beat.md)  
Cone: [`../howl-live/howlLive.js`](../howl-live/howlLive.js) (`howlPose`, `pickHowlLane`)  
Lena LOD (world fill, same cone): [`../lena-lod/lenaLod.js`](../lena-lod/lenaLod.js)  
Lights and openables (same cone, law 38): [`../gpu-light/gpuLight.js`](../gpu-light/gpuLight.js) · [`../gpu-openable/gpuOpenable.js`](../gpu-openable/gpuOpenable.js)

## Wire (Build)

1. Cook densify Video A as one clean 3-lane loop (first + last). **GPU is REQUIRED** for the path, Lena bibs, Howl, and Bolt: keyed layers composited over that plate. **FAIL** if you paint the path, a lane target, a generator, or a detail into Video A.
2. Copy `pathBeat.js` into Live next to `howlLive.js`. Call `pathBeatFrame` every frame. Call `lenaFrame` on its own — LOD fills the world; this module names the lane.
3. While `active` is set, draw `frame.revealHook` on the GPU (`hook.dest`, `hook.op`: `light` / `form` / `fill`). Same `howlPose` ground as Lena and Howl. Grade from this densify plate. Crossfade with `warmK`. Contact shadow only when `contact` is true (near band). Optional look: `biome/fx/path/chemin.mp4`, keyed, same world. Not a HUD arrow. Not a sticker. Not a pixel of Video A.
4. Pass densify plate time as `now`. `approach` is `1 / HOWL.travel` (Lena’s z step). Do not run a second clock.
5. Player SIDES with the existing lane control (`playerLane` = `L` / `C` / `R`). This module does not move Bolt.
6. When `resolved` fires, `result` is `hit` or `miss`. That beat leaves the cone. It does not stay under the paws.
7. `assertPathNative(frame)` must be `[]`. `tileDensify` and `coversPlate` stay false. `hud` stays false.

`bash biome/scripts/biome-cook/biome-cook.sh path`
