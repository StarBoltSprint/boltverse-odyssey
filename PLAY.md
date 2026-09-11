# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall. Player: [ENGINE.md](ENGINE.md). Cook: [COOKLANE.md](COOKLANE.md).

Clock: [cue-coyote.mjs](scripts/cue-coyote.mjs) · Hold: [video-hold.mjs](scripts/video-hold.mjs) · Reel: [sprint-transition.mjs](scripts/sprint-transition.mjs) · DOM: [dom-swap.mjs](scripts/dom-swap.mjs).

## Three machines

| Machine | File | Says |
|---|---|---|
| **DOM** | [dom-swap.mjs](scripts/dom-swap.mjs) | what is **visible** |
| **HOLD** | [video-hold.mjs](scripts/video-hold.mjs) | whether we **judge** |
| **Partition** | coyote + reel | **which reel** (`m`, `t_run`, palette) |

Only `running` may `resolveFrame` / bump `m` / tick `t_run`. Peak does **not** raise the veil. `pickNext` only in `ended-wait`.

## `m` + bone (`t_run`)

`m ∈ [0.05, 1]` — one Lane minute. `m` = follow the dog. `t_run` = age of the storm. Peak = both.

**`m` must not:** change `playbackRate` · move coyote · recook Imagine · advance during HOLD. Acts at the **JOIN**.

**The mp4 rate is constantly 1.** No `rate = f(m)`.

Sprint rate = density of the next reel ([COOKLANE.md](COOKLANE.md)):

```
ρ      = N_cues / duration_s
ρ_glow = sum(off−on) / duration_s    // aim 0.15–0.35; ≈1 = farm
calm 0.07–0.10 · lean 0.12–0.22 · peak 0.22–0.35
never two cues at once
```

Quiet cannot serve peak ρ even if `m` is high. Clean minute ≈ **8–9 cues**, not 40 notes.

### `t_run` integrator

```
onTime(t):
  if held: lastT = t; return
  Δ = t − lastT; lastT = t
  if kind == sprint and 0 ≤ Δ ≤ 0.5: t_run += Δ
  resolveFrame(...)
```

Seek / HOLD / hall breath / decay: no +=. Cut 8/12 → += ~8. Boot `t_run = 0`.

### Verdict (once per cue)

Hit `m += 0.10` · Miss `× 0.70` floor 0.05 + peakBan · Late peakBan · Early same cue.  
Idle-decay: −0.015 / s. `peakBan` clears at join. Boot `m = 0.12`.

Bone: Quiet [0,8) calm only · Lean [8,20) · Build [20,45) peak closed · Peak [45,70] if `m≥0.70` && !ban.

### Tests

6 Hits before 8 s → still calm. Hidden 10 s → frozen. `playbackRate` never ≠ 1.

## Cue + HOLD

Hit `[on−0.08, off]` · Late `(off, off+C]` · `C = min(0.22, next.on−off)`. Year-0: pose, L, R, fork. 40/20/40.

## Hard fences

Never two cues at once. Never peak before `t_run ≥ 45`. One `flushOpen` per plate. `joinEnded` still first.

## One line

**ρ calm ≈ one gesture / 12 s; peak ≈ one / 3 s; never two at once.** Mp4 rate stays 1.
