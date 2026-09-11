# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall. Player: [ENGINE.md](ENGINE.md). Cook: [COOKLANE.md](COOKLANE.md).  
Hall → Lane joint: [HANDOFF.md](HANDOFF.md).

Clock: [cue-coyote.mjs](scripts/cue-coyote.mjs) · Hold: [video-hold.mjs](scripts/video-hold.mjs) · Reel: [sprint-transition.mjs](scripts/sprint-transition.mjs) (`onLaneTime`) · DOM: [dom-swap.mjs](scripts/dom-swap.mjs).

## Five states

```
hall-breath → hall-walk → hall-enter → handoff → lane-running
```

`ended(enter)` → handoff (HOLD, veil, `m = 0.12`, `t_run = 0`).  
`t_run` starts only when hid `paused === false`. First hung cue only in `lane-running`.  
Missing `coming: false` or first hung plate → 2nd tap **stay**. No loader. No live Imagine.  
Do not carry hall `m`. Tapping doors well ≠ start in lean.

## Once `lane-running`

DOM = visible. HOLD = if we judge. Partition = which reel. **Must** call `onLaneTime`.

Idle-decay not during an open cue. Quiet: 6 Hits before 8 s still serve **calm**. Mp4 rate = **1**. `L` 3/3.

`pickNext` may only pick a plate whose `from` = current `to`. Hung year-0 is a **path of stations**, not a drawer shuffle. L1 then R1 (both from C) is illegal. [COOKLANE.md](COOKLANE.md)

## Join — 0 ms only if last = first

Sprint fade = **0**. That cut is legal **only** if `last(n)` is the same photo as `first(n+1)`.

If the files differ (4 leans cooked from bolt-back, crystals reset, vanishing point jumps) the 0 ms cut **is** the teleport.

HOLD still n until hid n+1 is actually playing. Same ENGINE order: still first, hide vis after.  
Files do not kiss → do not Hang. Recook the chain. Smoke: `lane.joint`.

Wobble (center → side → center in one plate) is not a join bug. It is `lane.wobble`. One plate = one act he **keeps**.

## Sound — two buses, film stays mute

Hung mp4 is **`-an`**. Two `<audio>` tags beside it. Never the `<video>` track.

| Bus | What | When |
|---|---|---|
| **1 lit** | `audio/<id>-lit-calm.ogg` … peak / decay | fade **at join** 100–200 ms |
| **2 grade** | `audio/grade-hit.ogg` / late / miss (< 200 ms) | iff `!HOLD` |

Early / idle = silence. HOLD mutes both. Do not pitch with `m`. Missing ogg → silence, sprint continues.  
**Year-0:** bus 2 only. Handoff join → lit of first hung plate (or mute). Enter mp4 `-an` too.

## One line

**Enter poses the dog; first hung plate makes him run; `m` and `t_run` are born at zero when hid plays.** Join 0 ms only if last = first. The film stays mute.
