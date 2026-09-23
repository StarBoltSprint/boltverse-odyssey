# 37 — Path beat generator (chemin lookahead)

**Sealed 2026-09-23 (SmiR product lock).** Runtime hang. Hang ≠ wipe. Does not recook hung masters. Does not invent a gallop. Does not change a Live URL.

Runtime: [`../scripts/path-beat/pathBeat.js`](../scripts/path-beat/pathBeat.js) — `pathBeatFrame` / `pathBeatChart` / `pathBeatResolve`.  
Brief: [`COLD_START-path-beat.md`](COLD_START-path-beat.md)  
Cone: [`../scripts/howl-live/howlLive.js`](../scripts/howl-live/howlLive.js) (`howlPose`, `pickHowlLane`).  
World fill on that same cone: [`36`](36-gpu-zones-lena-procedural.md) · [`../scripts/lena-lod/lenaLod.js`](../scripts/lena-lod/lenaLod.js).

Imagine = look. Code = when and where.

The reveal is **native to the densify film**. A HUD arrow, a sticker quad, or a second cone is FAIL.

**GPU is REQUIRED.** Path beat, Lena LOD bibs, Howl, and Bolt are GPU keyed layers composited **OVER** densify Video A. Densify stays the clean looping 3-lane plate. **FAIL if Build paints the path into Video A instead of the GPU.** Same FAIL for lane targets, generators, or details baked into that Imagine. `frame.gpu === true`. `frame.bakeIntoDensify === false`. `frame.composite === "over-densify"`.

---

## Product

The path (chemin) forms about **3 seconds ahead** of the player. Default `PATH_BEAT.lookahead = 3.0`. It is not drawn under the paws, and it is not the whole densify plate lighting up at once.

At reveal (`tContact - lookahead`) Live learns the target lane: `L`, `C`, or `R`. The player SIDES during that window. At contact, Live compares `playerLane` to the target.

| Moment | What Live knows |
|---|---|
| Before `tReveal` | No target lane yet |
| `tReveal` → `tContact` | Target lane, marker on the cone, still ahead of the paws |
| `tContact` | `hit` if the player lane matches, otherwise `miss`. The beat leaves the cone |

Densify (Rail A) stays the continuous 3-lane loop ([22-m](22-m-densify-snowball.md) · [36](36-gpu-zones-lena-procedural.md)). A seed + gap chart (`pathBeatChart`) drives the sprint. Lanes are not baked into Video A.

---

## Same cone as Howl / Lena

Placement is `howlPose`. Travel time is `HOWL.travel`. Three seconds of lookahead is `z = lookahead / HOWL.travel` — up the road, not at the paw line.

`pickPathLane` uses the same occupancy set as `pickHowlLane` (`blocked` + `plate`, lanes `-1 | 0 | 1`). Howl and Lena share a taken lane so one corridor stays free. The path beat sends the player down **that** corridor. A plate with no free lane schedules nothing. There is no second geometry stack.

Lane letters: `L = -1`, `C = 0`, `R = 1` (screen-left is negative, same sign as law [12](12-lane-path-ribbon.md)). Player X stays the existing lane shift. This module only names the target and places the chemin quad.

Lena LOD fills the world (bibs, bands, climb). The path beat tells which lane to be in. Call both. Do not merge them into one spawner.

---

## Call

```js
import { pathBeatState, pathBeatFrame } from "./pathBeat.js";

let state = pathBeatState(seed);
const frame = pathBeatFrame(state, dt, {
  now,            // seconds
  cw, ch, pawY, destH0,
  playerLane,     // "L" | "C" | "R" after SIDES
  blocked,        // rail-A lanes already taken, -1 | 0 | 1
  plate,          // other rail-B lanes this beat
});
state = frame.state;
```

- `frame.active` — the open window. `active.lane`, `active.secondsLeft` (~3 at reveal), `active.pose` on the densify lane. `active.reveal` is the in-world read (`light` / `detail` / `fill`).
- `frame.resolved[]` — this tick’s `{ result: "hit" | "miss", lane, playerLane }`.
- `frame.gradeFromPlate`, `frame.hud === false`, `frame.clock === "densify"`, `frame.approach`.
- `frame.revealHook` — Live draw. `pathRevealHook(frame.active)`. `op` is `light` (lane lights up), `form` (detail forms), or `fill` (void fills). `dest` is the cone quad. `draw` is false before reveal.
- `assertPathNative(frame)` — `[]` or a list of FAIL reasons.
- `frame.tileDensify` and `frame.coversPlate` are false.
- `pathBeatChart(seed, { count })` — the same beats without a canvas, for a cold sprint chart.

Optional look file: `biome/fx/path/chemin.mp4` (one keyed lane segment). Pixels may be Imagine. Timing may not.

---

## Native to the video

Densify’s **3 lanes are the truth**. Path beat, Lena, and Howl share `howlPose` (same cone, same perspective, same ground). `frame.lanes === 3`. `frame.cone === "howlPose"`.

| Lock | Runtime | FAIL |
|---|---|---|
| One geometry | `pose` is `howlPose` on densify lanes `-1 / 0 / 1` | A second ribbon, a screen-space lane, a cone of your own |
| Grade from plate | `gradeFromPlate: true` on the frame and on every beat | A bib whose color, bloom, or mist does not come from this densify plate |
| Motion lock | `approach === 1 / HOWL.travel` (the Lena z step). `clock === "densify"`. `now` is plate time | A chemin that slides faster or slower than the plate. A shadow on far or mid. A band pop (`warmK` jumps) |
| In world | `hud: false`, `inWorld: true`, `space: "world"`. `reveal` is `light` (lane lights up) → `detail` (detail forms) → `fill` (void fills) | A HUD arrow, a corner icon, an overlay that is not on the road |
| Cook | `cook.densify` is a clean 3-lane loop, vault on, sides calm. Bibs are keyed and the same world. Bolt is `lock/bolt-back.jpg` | A busy plate, a bib from another biome, a new dog |
| One film | `tileDensify: false`, `coversPlate: false`, `sameClock: true` | Spatial slices of Video A. A second clock for the beat |
| GPU required | `gpu: true`, `composite: "over-densify"`, `bakeIntoDensify: false` | Painting the path, a lane target, a generator, or a detail into densify Video A |

Contact shadow is **only** when `band === "near"` (`contact: true`). Far and mid get no shadow. Band edges use Lena’s `warm` / `warmK` so the in-world detail crossfades.

`assertPathNative(frame)` returns `[]` when the frame keeps this lock. Any string in that list is a FAIL. Do not Hang a frame that fails it.

---

## FAIL

- **Painting the path into densify Video A instead of a GPU keyed layer over that plate.** Same FAIL for a lane target, a generator, or a detail bib baked into the densify Imagine. `gpu` must be true. `bakeIntoDensify` must be false.
- A HUD arrow, badge, or screen overlay instead of an in-world lane
- A sticker bib that is not graded from this densify plate (`gradeFromPlate` false)
- A second cone, or a perspective that is not `howlPose` on densify’s 3 lanes
- Approach speed that is not `1 / HOWL.travel` (densify scroll / Lena step)
- A contact shadow outside the near band, or a hard LOD pop
- Baking the target lane into densify Video A
- Tiling or slicing the densify loop, or running the beat on its own clock
- Lighting the whole plate, or drawing the chemin under the paws for the length of the plate
- A densify that is not a clean 3-lane loop with vault and calm sides
- Bibs from another world, or a Bolt that is not the white-coat identity lock
- Scoring a beat by inventing a new Bolt sprint
- A play URL, Build `/c/` link, or `grok.com/share` from this note

Related: [36](36-gpu-zones-lena-procedural.md) · [38](38-gpu-light-openable.md) (light layers + openables, same cone, over densify) · [34](34-howl-live-aim.md) · [32](32-howl-gpu-targets.md) · [19](19-luminous-path-climb.md) · [12](12-lane-path-ribbon.md) · [22-m](22-m-densify-snowball.md) · runtime [`../scripts/path-beat/pathBeat.js`](../scripts/path-beat/pathBeat.js) · paste [`COLD_START-path-beat.md`](COLD_START-path-beat.md) · light [`COLD_START-gpu-light-openable.md`](COLD_START-gpu-light-openable.md)
