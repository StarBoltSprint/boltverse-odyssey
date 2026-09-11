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

`m ∈ [0.05, 1]` — one Lane minute. Chrome: Resonance (bar only).  
`m` = *are you still following Bolt?* `t_run` = *age of the storm*. Peak = both.

**`m` must not:** change `playbackRate` · move coyote · pulse the bar · skip a plate · recook Imagine · advance during HOLD. Acts at the **JOIN**.

**The mp4 rate is constantly 1.** `video.playbackRate = 1` on HOLD, Hit, Miss, peak. No `rate = f(m)`. Even ±5 % desyncs glow vs finger. 1.25 would age `t_run` in 36 s wall for 45 s of bone.

The rate the player **feels** is density on the next reel ([COOKLANE.md](COOKLANE.md)):

```
ρ = hittable cues / duration_s
calm ≈ 0.08 /s · lean ≈ 0.20 /s · peak ≈ 0.33 /s · decay ≈ 0–0.10 /s
```

`m` + `t_run` pick the drawer → ρ jumps at **join**. Not a cassette stretch.

### `t_run` is an integrator of frames **really played**

Picture-time. Not wall clock. Not `Date.now`. Not file durations.

```
onTime(t):
  if held: lastT = t; return
  Δ = t − lastT
  lastT = t
  if kind == sprint and 0 ≤ Δ ≤ 0.5:
    t_run += Δ
  resolveFrame(...)
```

`Δ > 0.5` or `< 0` = seek — ignore. HOLD / hall breath / `kind: decay` do not +=. Idle on a playing sprint plate **does** age `t_run`. Cut 8 s of 12 → += ~8.

Boot / hall→Lane / end of Lane: `t_run = 0`.

### Verdict (once per cue)

| Verdict | `m` | Other |
|---|---|---|
| Hit | `min(1, m + 0.10)` | |
| Late | unchanged | `peakBan` |
| Miss / wrong side | `max(0.05, m × 0.70)` | `peakBan` |
| Early | unchanged | same cue |

Idle-decay: each 1.0 s idle → `m − 0.015` (floor 0.05). `peakBan` clears at join. Boot `m = 0.12`.

### Bone permission

```
[0, 8)     Quiet   — calm only
[8, 20)    Lean    — calm or lean by m
[20, 45)   Build   — lean (peak closed)
[45, 70]   Peak ok — IF m≥0.70 AND !peakBan
> 70       Close   — no peak
```

Bar: ~3–4 % of 9:16, fill ∝ `m`, no flash. Bus 2 only if `!HOLD`.

### Tests

- 6 Hits before 8 s → still calm
- Cut 8/12 → `t_run` += ~8
- Hidden 10 s → frozen
- `playbackRate` never ≠ 1 · never `rate = lerp(m)`

## Cue + HOLD

Hit `[on−0.08, off]` · Late `(off, off+C]` · `C = min(0.22, next.on−off)`. Year-0: pose, L, R, fork. Same 40/20/40.

## Hard fences

- Never `+= duration` of the file. Never `Date.now`.
- Never `playbackRate ≠ 1`. Never peak before `t_run ≥ 45`.
- One `flushOpen` per plate. `joinEnded` still first.

## One line

**The mp4 rate = 1. The sprint rate = ρ of the next reel.** `t_run` is frames you actually saw. Peak needs `m` too.
