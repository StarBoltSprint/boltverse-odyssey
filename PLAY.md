# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall. Player: [ENGINE.md](ENGINE.md). Cook: [COOKLANE.md](COOKLANE.md).

Clock: [cue-coyote.mjs](scripts/cue-coyote.mjs) · Hold: [video-hold.mjs](scripts/video-hold.mjs) · Reel: [sprint-transition.mjs](scripts/sprint-transition.mjs) (`onLaneTime`) · DOM: [dom-swap.mjs](scripts/dom-swap.mjs).

## Three machines

DOM = visible. HOLD = if we judge. Partition = which reel (`m`, `t_run`).  
Player **must** call `onLaneTime` — else `t_run` stays 0.

Idle-decay not during an open cue. HOLD: lastT tracks, no leak. Quiet: 6 Hits before 8 s still serve **calm**.

Mp4 rate = **1**. Sprint rate = ρ of the next reel. `L` 3/3.

## Sound — two buses, film stays mute

The hung mp4 is **`-an`**. All sound is **beside** it, on picture-time + HOLD. Two `<audio>` tags. Never the `<video>` track (Safari + dual-video kills `play()`).

| Bus | What | When |
|---|---|---|
| **1 lit** | world loop (`audio/<id>-lit-calm.ogg` … peak / decay) | fade **at join** 100–200 ms, never on a cue |
| **2 grade** | `audio/grade-hit.ogg` / late / miss  (< 200 ms) | oneshot iff `!HOLD` |

Early / idle = **silence**. If the lit **says the beat**, mute bus 1 (same crime as a TAP bar).

HOLD → both buses pause/mute. Resume does **not** unmute the mp4. `video.muted = true` always. Do not pitch the lit with `m` (same lie as `playbackRate`).

Switch lit = `pickNext` / `afterJoin`, not `timeupdate`.

Missing ogg → that bus silent, **sprint continues**. Never block a run for audio.

**Year-0:** ship **bus 2 only** (Hit/Miss) + bus 1 mute. Wind can wait. Do **not** bake sound into Imagine « to feel alive ».

## One line

**Lit = file per tier, cut at join, freeze on HOLD. Grade = a dry click if the clock is running. The film stays mute.**
