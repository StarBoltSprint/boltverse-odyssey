# jade-billboard — law 44 card tick

Earlier one-file companion. The LOD hang is [`../jade-lod/README.md`](../jade-lod/README.md). LOD picks how much twin as you close in. It does not thicken the mp4.

Kitchen remix / Rail B card tick. One spawn row drives the card. The capsule is the same `(x, z, r)` via `volumeOf(row)` into SprintCore obstacles. Capsule code is not in this file.

Law: [`../../docs/44-imagine-volume-stack.md`](../../docs/44-imagine-volume-stack.md) · look graph [`../../docs/45-shader-graph-look-kitchen.md`](../../docs/45-shader-graph-look-kitchen.md)

Resting browser port is `MeshBasicMaterial` + `alphaTest` 0.45. That is the mask path. The fade path is a second material, eight at a time.

| File | Role |
|---|---|
| [`jadeBillboard.ts`](jadeBillboard.ts) | `tickCards` · `volumeOf` · `DRAW_ORDER` · `billboardYaw` · `bandOf` |

Paint order each frame: sky → ground film → far décor (in the plate) → `tickCards` mid → near → shadows → Bolt → howl/fx.

Far band draws nothing. Those trees stay in the ground film so you do not billboard the horizon.

If you only run `tickCards`, it looks deep and you still walk through bark. Also feed `volumeOf`.

There is no `biomes.ts` on this repo today. Place this script as the sibling of the future spawn/biomes table, or next to whatever spawn table a remix already uses. Do not invent a fake `biomes.ts`.

This snippet uses `three` so a remix can port the tick. Odyssey forest KEEP (`pyre-stage`) is a WebGL composite of Imagine videos. Do not rewrite `pyre-stage` into a Three.js world. World pixels stay Imagine. Three.js does not build the world.
