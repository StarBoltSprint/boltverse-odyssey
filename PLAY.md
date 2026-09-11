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
`t_run` starts only when hid `paused === false`. First calm cue only in `lane-running`.  
Missing `coming: false` or `calm-1` → 2nd tap **stay**. No loader. No live Imagine.  
Do not carry hall `m`. Tapping doors well ≠ start in lean.

## Once `lane-running`

DOM = visible. HOLD = if we judge. Partition = which reel. **Must** call `onLaneTime`.

Idle-decay not during an open cue. Quiet: 6 Hits before 8 s still serve **calm**. Mp4 rate = **1**. `L` 3/3.

## Sound — two buses, film stays mute

Hung mp4 is **`-an`**. Two `<audio>` tags beside it. Never the `<video>` track.

| Bus | What | When |
|---|---|---|
| **1 lit** | `audio/<id>-lit-calm.ogg` … peak / decay | fade **at join** 100–200 ms |
| **2 grade** | `audio/grade-hit.ogg` / late / miss (< 200 ms) | iff `!HOLD` |

Early / idle = silence. HOLD mutes both. Do not pitch with `m`. Missing ogg → silence, sprint continues.  
**Year-0:** bus 2 only. Handoff join → lit-calm (or mute). Enter mp4 `-an` too.

## One line

**Enter poses the dog; calm-1 makes him run; `m` and `t_run` are born at zero when hid plays.** The film stays mute.
