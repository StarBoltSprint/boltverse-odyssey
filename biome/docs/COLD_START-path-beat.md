# COLD START — Path beat (clés en main)

Read `biome/docs/37-path-beat.md`. Runtime: `biome/scripts/path-beat/pathBeat.js`. Run `node biome/scripts/path-beat/demo.js`.

Densify Video A stays a **SuperGrok session** Imagine Video with **first + last** pinned: one continuous 3-lane loop. Build does not drive that session. Missing `XAI_API_KEY` is not a stop. Do not paint L/C/R targets into that plate. Do not tile it.

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
| Densify loop (Rail A) | The 3-lane picture. Continuous. Dodge cinema stays in the plate. |
| Lena LOD (`lenaFrame`) | World fill. Bibs, far/mid/near, earth → deep space. Same cone. |
| Path beat (`pathBeatFrame`) | Which lane to be in, and when. Reveal ~3 s ahead. Hit / miss at contact. |
| Howl (`pickHowlLane`) | Obstacles share taken lanes so one corridor stays free. Path beat aims the player at that corridor. |

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
