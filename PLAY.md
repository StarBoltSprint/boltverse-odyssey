# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall. Player: [ENGINE.md](ENGINE.md). Cook: [COOKLANE.md](COOKLANE.md).

Clock: [cue-coyote.mjs](scripts/cue-coyote.mjs) · Hold: [video-hold.mjs](scripts/video-hold.mjs) · Reel: [sprint-transition.mjs](scripts/sprint-transition.mjs) (`onLaneTime`) · DOM: [dom-swap.mjs](scripts/dom-swap.mjs).

## Three machines

DOM = visible. HOLD = if we judge. Partition = which reel (`m`, `t_run`).  
Only `running` ticks. Player **must** call `onLaneTime` — else `t_run` stays 0 and you fall back to `m` alone.

```
if (!held):
  tickRun
  if !cue_open && idle_plate: tickIdle   // −0.015 / s picture-time
  resolveFrame
  applyVerdict
```

Do **not** idle-decay during an open cue (that is wait / Hit / Miss). HOLD: lastT tracks, no leak.

8 s idle: `m` −0.12. Quiet: 6 Hits before 8 s still serve **calm**. `m < 0.18` → decay drawer.

Mp4 rate = **1**. Sprint rate = ρ of the next reel. `L` 3/3 ([COOKLANE.md](COOKLANE.md)).

Bone: Quiet [0,8) · Lean [8,20) · Build [20,45) · Peak [45,70] if `m≥0.70` && !ban.

## One line

**`t_run` counts race frames. Idle-decay gnaws `m` only if the picture runs and you are not playing.**
