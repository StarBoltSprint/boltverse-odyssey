# lena-lod — law 36 runtime

Procedural placement and LOD for Rail B. The cone is `howlPose`. The lane pick is `pickHowlLane`. This folder does not draw Howl rings and does not cut the densify plate.

| File | Role |
|---|---|
| [`lenaLod.js`](lenaLod.js) | `objectBand` · `preloadOf` · `worldLod` · `bibFile` · `lenaResolve` · `lenaFrame` |
| [`demo.js`](demo.js) | `node demo.js` — bands, bib path, spawn in front of the paws |

Law: [`../../docs/36-gpu-zones-lena-procedural.md`](../../docs/36-gpu-zones-lena-procedural.md)  
Bib cook: [`../../docs/COLD_START-lena-bib.md`](../../docs/COLD_START-lena-bib.md)  
Cone: [`../howl-live/howlLive.js`](../howl-live/howlLive.js)  
Lane clock on that cone: [`../path-beat/pathBeat.js`](../path-beat/pathBeat.js) (law 37 — which lane, ~3 s ahead). This folder still only places bibs.

## Wire (Build)

1. Cook densify Video A in the SuperGrok session (first + last). Do not ask Build to drive that session.
2. Hang the Imagine bib at the paths `bibFile(world, noun, variant)` returns.
3. Copy `lenaLod.js` into Live next to `howlLive.js`.
4. Each frame: `lenaFrame(state, dt, ctx)`. Draw `spawn.pose.dest` as a keyed quad (`mark` / `markDest`), same family as Bolt. When `warmBib` is set, fetch it. Crossfade with `warmK` on that same quad.
5. Near band sets `contact` so the shadow sits on the road (law 13b). Grade from this plate.
6. Howl rings = `biome/fx/howl/howl-attack.mp4`. On contact, law 34 swaps `spawn.shatter`. Do not shader the rings.

`bash biome/scripts/biome-cook/biome-cook.sh lena`
