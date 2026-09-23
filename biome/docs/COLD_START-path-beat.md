# COLD START — Path beat (clés en main)

Read `biome/docs/37-path-beat.md`. Runtime: `biome/scripts/path-beat/pathBeat.js`. Run `node biome/scripts/path-beat/demo.js`.

Densify Video A stays a **SuperGrok session** Imagine Video with **first + last** pinned: one continuous 3-lane loop. Build does not drive that session. Missing `XAI_API_KEY` is not a stop. Do not paint L/C/R targets into that plate. Do not tile it.

The **chemin** is code on the Howl cone. It forms ~**3.0 s** ahead of contact (`PATH_BEAT.lookahead`), on one lane, so the player can SIDES before the paws arrive. Imagine, if you cook a look, is one keyed lane segment at `biome/fx/path/chemin.mp4` — not a densify crop, not the whole road.

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
- From reveal until contact: `frame.active.lane` is the target. `active.secondsLeft` starts at ~3. `active.pose` is `howlPose` up the road (`active.ahead`). Draw **one** quad on `pose.dest`.
- At contact: `frame.resolved[0].result` is `"hit"` or `"miss"`. The beat is gone from `frame.beats`. It does not sit under the paws.
- `frame.tileDensify` and `frame.coversPlate` are false. Densify is still Rail A, one loop.

SIDES is the player’s lane (`L` left, `C` center, `R` right) during the open window. Contact samples that lane once. A missing lane is a miss.

`blocked: [-1, 1]` (left and right already taken) → every beat is `C`, the corridor `pickHowlLane` refused to close. `[-1, 0, 1]` → no beat. Do not force the player into a wall.
