# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall. Player: [ENGINE.md](ENGINE.md). Cook: [COOKLANE.md](COOKLANE.md).

Clock: [cue-coyote.mjs](scripts/cue-coyote.mjs) · Hold: [video-hold.mjs](scripts/video-hold.mjs) · Reel: [sprint-transition.mjs](scripts/sprint-transition.mjs) · DOM: [dom-swap.mjs](scripts/dom-swap.mjs) · `L`: [cue-readability.mjs](scripts/cue-readability.mjs).

## Three machines

| Machine | File | Says |
|---|---|---|
| **DOM** | [dom-swap.mjs](scripts/dom-swap.mjs) | what is **visible** |
| **HOLD** | [video-hold.mjs](scripts/video-hold.mjs) | whether we **judge** |
| **Partition** | coyote + reel | **which reel** (`m`, `t_run`, palette) |

Only `running` may `resolveFrame` / bump `m` / tick `t_run`. Peak does **not** raise the veil. `pickNext` only in `ended-wait`.

## `m` + bone (`t_run`)

`m` = follow the dog. `t_run` = age of the storm. Peak = both. Mp4 rate = **1**.

Sprint rate = ρ of the next reel. Chart readable = **`L` 3/3** ([COOKLANE.md](COOKLANE.md)). 2/3 = nudge the window. 1/3 = recook. A ring does not fix it.

Quiet cannot serve peak ρ. Clean minute ≈ **8–9 cues**. Never two cues at once.

### `t_run` integrator

`Δ = currentTime − lastT` if sprint && !held && `0 ≤ Δ ≤ 0.5`. Boot `t_run = 0`.

### Verdict

Hit `m += 0.10` · Miss `× 0.70` floor 0.05 + peakBan · Late peakBan · Early same cue. Coyote is **outside** `L`. Boot `m = 0.12`.

Bone: Quiet [0,8) · Lean [8,20) · Build [20,45) peak closed · Peak [45,70] if `m≥0.70` && !ban.

## Hard fences

Never Hang 1/3. Never peak before `t_run ≥ 45`. One `flushOpen` per plate. Never grow coyote to hide a hole in `L`.

## One line

**With 3 photos, readable = all three. Two = move the window. One = recook.**
