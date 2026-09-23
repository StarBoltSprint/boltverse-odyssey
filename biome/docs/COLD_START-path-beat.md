# COLD START — Path beat (clés en main)

Read `biome/docs/37-path-beat.md`. Runtime: `biome/scripts/path-beat/pathBeat.js`. Run `node biome/scripts/path-beat/demo.js`.

## **GPU is REQUIRED.**

Path beat reveal (~3 s ahead, in the road), Lena LOD bibs, Howl, and Bolt are **GPU keyed layers composited OVER densify Video A**.

Densify stays the **clean looping 3-lane plate**. Imagine Video A does not receive the path, lane targets, generators, or detail bibs.

**FAIL if Build paints the path into Video A instead of the GPU.** Same FAIL for a lane target, a generator, or a detail baked into that densify Imagine. `frame.gpu` is `true`. `frame.composite` is `"over-densify"`. `frame.bakeIntoDensify` is `false`. `assertPathNative` returns `"baked into densify"` or `"GPU"` if you break this.

Densify Video A stays a **SuperGrok session** Imagine Video with **first + last** pinned: one continuous 3-lane loop. Build does not drive that session. Missing `XAI_API_KEY` is not a stop. Do not tile it.

The **chemin** is code on the Howl cone. It forms ~**3.0 s** ahead of contact (`PATH_BEAT.lookahead`), on one lane, so the player can SIDES before the paws arrive. The player reads it **in the road**. Imagine, if you cook a look, is one keyed lane segment at `biome/fx/path/chemin.mp4` — same world and materials as the plate, graded from that plate, not a densify crop, not a HUD arrow.

## Native to the video — FAIL if violated

`assertPathNative(frame)` must return `[]`. These six locks are the hang. Break one and the beat is a sticker.

1. **One geometry.** Densify’s 3 lanes are the truth. Path beat, Lena, and Howl share `howlPose` — same cone, same perspective, same ground. `frame.cone` is `"howlPose"`. `frame.lanes` is `3`. Do not invent a second stack.
2. **Grade from plate.** Every keyed bib, including the chemin, sets `gradeFromPlate: true`. Color, bloom, and mist come from **this** densify plate. A mismatched light is FAIL.
3. **Motion lock.** `frame.approach` is `1 / HOWL.travel`, the same z step as `lenaFrame`. `frame.clock` is `"densify"` — pass plate time as `now`. Contact shadow only when `beat.band === "near"` (`beat.contact`). Far and mid stay shadow-free. Band changes crossfade with `warm` / `warmK`. A pop is FAIL.
4. **In world, not a HUD.** `frame.hud` is false. `beat.space` is `"world"`. The ~3 s path reveals on the lane: `reveal: "light"` (the lane lights up), `"detail"` (detail forms), `"fill"` (the void fills). The player reads the road. An arrow, a badge, or a corner widget is FAIL.
5. **Cook coherence.** Densify Video A is a clean 3-lane loop, vault overhead, sides calm. Bibs are keyed and use that same world and those materials. Bolt stays the identity lock `lock/bolt-back.jpg` (white coat). `frame.cook` carries this contract.
6. **One film, one clock.** Densify is a continuous plate. `tileDensify` and `coversPlate` are false. Engine layers (Bolt, Lena, Howl, path beat) stack on that densify clock (`sameClock: true`). Do not slice Video A into spatial tiles.

Call `assertPathNative` on the frame you are about to draw. A non-empty list is FAIL. Do not Hang it.

## Who owns what

| Piece | Owns |
|---|---|
| Densify loop (Rail A) | The clean 3-lane picture. Continuous Imagine film. No path, no generators, no detail bibs painted in. |
| Bolt | GPU keyed identity lock, composited **over** densify. |
| Lena LOD (`lenaFrame`) | GPU keyed bibs. World fill. Far/mid/near. Same cone. **Over** densify. |
| Howl | GPU keyed KEEP rings **over** densify. Obstacles share taken lanes so one corridor stays free. |
| Path beat (`pathBeatFrame`) | GPU keyed in-world reveal ~3 s ahead. Which lane, and when. Hit / miss at contact. **Over** densify. |

LOD fills the world. The path beat tells which lane to be in. Call both each frame. Do not fold the beat into the bib spawner.

## Chart (no canvas)

```js
import { pathBeatChart } from "./pathBeat.js";

const chart = pathBeatChart(seed, { count: 8 });
// chart.beats[] = { tReveal, tContact, lane: "L"|"C"|"R", laneIndex }
// tContact - tReveal === 3
// chart.tileDensify === false
```

Gaps come from the seed (`gapMin` 4.5 … `gapMax` 7.5). A cold Grok can drive the sprint from this chart. Video A stays empty of those lanes.

## One stack (densify film, then GPU)

Same `now` for every line. Densify is the looping plate. Build does **not** drive that Imagine first+last session. The session stays SuperGrok, first + last pinned. Missing `XAI_API_KEY` is not a stop.

```js
import { lenaState, lenaFrame } from "../lena-lod/lenaLod.js";
import { pathBeatState, pathBeatFrame, assertPathNative } from "./pathBeat.js";

// 1. Densify Video A plays. Do not write path, generators, or details into it.
// 2. GPU keyed layers OVER that plate, one clock:
const lena = lenaFrame(lenaState, dt, ctx);          // bibs, far/mid/near
const frame = pathBeatFrame(pathState, dt, ctx);     // which lane, ~3s ahead
const hook = frame.revealHook;                       // light | form | fill
if (assertPathNative(frame).length) throw new Error("path native FAIL");
if (hook.draw) {
  // GPU quad on hook.dest. gradeFromPlate. op is the in-world read.
  // light = lane lights up, form = detail forms, fill = void fills.
  // Bolt and Howl are the other keyed quads on this same cone. Not HUD.
}
```

| `hook.op` | In the road | Cone band |
|---|---|---|
| `light` | The target lane lights up | far |
| `form` | Detail forms on that lane | mid |
| `fill` | The void of that lane fills | near |

`hook.draw` is false before reveal. `hook.dest` is `howlPose` on the densify lane, ahead of the paws. `hook.gpu` is true. `hook.bakeIntoDensify` is false. `hook.hud` is false.

## Each frame

```js
import { pathBeatState, pathBeatFrame } from "./pathBeat.js";

let state = pathBeatState(seed);
const frame = pathBeatFrame(state, dt, {
  now,
  cw, ch, pawY, destH0,
  playerLane,   // "L" | "C" | "R" — existing SIDES (lane shift). This call does not move Bolt.
  blocked,      // rail-A lanes taken
  plate,        // other rail-B lanes
});
state = frame.state;
```

- Before `tReveal`: `frame.beats` is empty. The lane is not known yet.
- From reveal until contact: `frame.active.lane` is the target. `active.secondsLeft` starts at ~3. `active.pose` is `howlPose` on the densify lane, ahead of the paws. Draw that reveal **in the road** (`light` → `detail` → `fill`). Grade it from the plate (`gradeFromPlate`). Crossfade with `warmK`. Shadow only if `contact` is true (near band).
- At contact: `frame.resolved[0].result` is `"hit"` or `"miss"`. The beat is gone from `frame.beats`. It does not sit under the paws.
- `frame.tileDensify` and `frame.coversPlate` are false. `frame.hud` is false. `frame.clock` is `"densify"`. Densify is still Rail A, one loop, on one clock.

SIDES is the player’s lane (`L` left, `C` center, `R` right) during the open window. Contact samples that lane once. A missing lane is a miss.

`blocked: [-1, 1]` (left and right already taken) → every beat is `C`, the corridor `pickHowlLane` refused to close. `[-1, 0, 1]` → no beat. Do not force the player into a wall.
