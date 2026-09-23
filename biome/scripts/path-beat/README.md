# path-beat — law 37 runtime

The chemin reveals one target lane about **3 seconds** before contact. Densify stays one continuous loop. This folder does not slice Video A and does not build a second cone.

| File | Role |
|---|---|
| [`pathBeat.js`](pathBeat.js) | `pathBeatState` · `pathBeatFrame` · `pathBeatChart` · `pickPathLane` · `pathBeatResolve` |
| [`demo.js`](demo.js) | `node demo.js` — lookahead, L/C/R, hit/miss, densify not tiled |

Law: [`../../docs/37-path-beat.md`](../../docs/37-path-beat.md)  
Brief: [`../../docs/COLD_START-path-beat.md`](../../docs/COLD_START-path-beat.md)  
Cone: [`../howl-live/howlLive.js`](../howl-live/howlLive.js) (`howlPose`, `pickHowlLane`)  
Lena LOD (world fill, same cone): [`../lena-lod/lenaLod.js`](../lena-lod/lenaLod.js)

## Wire (Build)

1. Cook densify Video A as one 3-lane loop (first + last). Do not paint the target lane into that plate.
2. Copy `pathBeat.js` into Live next to `howlLive.js`. Call `pathBeatFrame` every frame. Call `lenaFrame` on its own — LOD fills the world; this module names the lane.
3. While `active` is set, the lane is known. Draw one keyed quad on `active.pose.dest` (same `mark` / `markDest` family as Bolt). Optional look: `biome/fx/path/chemin.mp4` (one lane segment, not a densify crop).
4. Player SIDES with the existing lane control (`playerLane` = `L` / `C` / `R`). This module does not move Bolt.
5. When `resolved` fires, `result` is `hit` or `miss`. That beat leaves the cone. It does not stay under the paws.
6. `tileDensify` and `coversPlate` stay false.

`bash biome/scripts/biome-cook/biome-cook.sh path`
