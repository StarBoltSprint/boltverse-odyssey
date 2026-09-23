# 37 — Path beat generator (chemin lookahead)

**Sealed 2026-09-23 (SmiR product lock).** Runtime hang. Hang ≠ wipe. Does not recook hung masters. Does not invent a gallop. Does not change a Live URL.

Runtime: [`../scripts/path-beat/pathBeat.js`](../scripts/path-beat/pathBeat.js) — `pathBeatFrame` / `pathBeatChart` / `pathBeatResolve`.  
Brief: [`COLD_START-path-beat.md`](COLD_START-path-beat.md)  
Cone: [`../scripts/howl-live/howlLive.js`](../scripts/howl-live/howlLive.js) (`howlPose`, `pickHowlLane`).  
World fill on that same cone: [`36`](36-gpu-zones-lena-procedural.md) · [`../scripts/lena-lod/lenaLod.js`](../scripts/lena-lod/lenaLod.js).

Imagine = look. Code = when and where.

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

- `frame.active` — the open window. `active.lane`, `active.secondsLeft` (~3 at reveal), `active.pose` for one quad.
- `frame.resolved[]` — this tick’s `{ result: "hit" | "miss", lane, playerLane }`.
- `frame.tileDensify` and `frame.coversPlate` are false.
- `pathBeatChart(seed, { count })` — the same beats without a canvas, for a cold sprint chart.

Optional look file: `biome/fx/path/chemin.mp4` (one keyed lane segment). Pixels may be Imagine. Timing may not.

---

## BAN

- Baking the target lane into densify Video A
- Lighting the whole plate, or tiling / slicing the densify loop
- Drawing the chemin under the paws for the length of the plate
- A second cone, ribbon, or lane index besides Howl / law 12
- Scoring a beat by inventing a new Bolt sprint
- A play URL, Build `/c/` link, or `grok.com/share` from this note

Related: [36](36-gpu-zones-lena-procedural.md) · [34](34-howl-live-aim.md) · [32](32-howl-gpu-targets.md) · [19](19-luminous-path-climb.md) · [12](12-lane-path-ribbon.md) · [22-m](22-m-densify-snowball.md) · runtime [`../scripts/path-beat/pathBeat.js`](../scripts/path-beat/pathBeat.js) · paste [`COLD_START-path-beat.md`](COLD_START-path-beat.md)
