# jade-billboard — law 44 card tick

Kitchen remix / Rail B card tick. One spawn row drives the card. The capsule is the same `(x, z, r)` via `volumeOf(row)` into SprintCore obstacles. Capsule code is not in this file.

Law: [`../../docs/44-imagine-volume-stack.md`](../../docs/44-imagine-volume-stack.md)

| File | Role |
|---|---|
| [`jadeBillboard.ts`](jadeBillboard.ts) | `tickCards` · `volumeOf` · `DRAW_ORDER` · `billboardYaw` · `bandOf` |

Paint order each frame: sky → ground film → far décor (in the plate) → `tickCards` mid → near → shadows → Bolt → howl/fx.

Far band draws nothing. Those trees stay in the ground film so you do not billboard the horizon.

If you only run `tickCards`, it looks deep and you still walk through bark. Also feed `volumeOf`.

There is no `biomes.ts` on this repo today. Place this script as the sibling of the future spawn/biomes table, or next to whatever spawn table a remix already uses. Do not invent a fake `biomes.ts`.

This snippet uses `three` so a remix can port the tick. Odyssey forest KEEP (`pyre-stage`) is a WebGL composite of Imagine videos. Do not rewrite `pyre-stage` into a Three.js world. World pixels stay Imagine. Three.js does not build the world.
