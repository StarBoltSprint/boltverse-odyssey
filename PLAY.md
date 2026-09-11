# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall. Player: [ENGINE.md](ENGINE.md). Cook: [COOKLANE.md](COOKLANE.md).  
Hall → Lane joint: [HANDOFF.md](HANDOFF.md).

Clock: [cue-coyote.mjs](scripts/cue-coyote.mjs) · Hold: [video-hold.mjs](scripts/video-hold.mjs) · Reel: [sprint-transition.mjs](scripts/sprint-transition.mjs) (`onLaneTime`) · DOM: [dom-swap.mjs](scripts/dom-swap.mjs).

## Five states (handoff is not a 6th engine)

```
hall-breath → hall-walk → hall-enter → handoff → lane-running
```

`ended(enter)` → `handoff` (HOLD, veil, `m = 0.12`, `t_run = 0`).  
`t_run` starts only when hid `paused === false`. First calm cue opens only in `lane-running`.  
2nd tap without `coming: false` + `calm-1` on disk = **stay**. No loader. No live Imagine.

Tapping hall doors well ≠ start in lean. Do not carry hall `m`.

## Three machines (once lane-running)

DOM = visible. HOLD = if we judge. Partition = which reel. Call `onLaneTime`.

Mp4 rate = **1**. Film `-an`. Sound = two buses beside it (year-0: grade only).

## One line

**Enter poses the dog; calm-1 makes him run; `m` and `t_run` are born at zero when hid plays.**
