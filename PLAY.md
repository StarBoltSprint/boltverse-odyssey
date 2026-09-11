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

### `t_run` is an integrator of frames **really played**

Picture-time. Not wall clock. Not `Date.now`. Not the sum of file durations.

```
t_run += Δ currentTime
  only if clock = running
  AND plate.kind = sprint   (calm | lean | peak)
```

```
onTime(t):
  if held: lastT = t; return
  Δ = t − lastT
  lastT = t
  if kind == sprint and 0 ≤ Δ ≤ 0.5:
    t_run += Δ
  resolveFrame(...)
```

`Δ > 0.5` or `Δ < 0` = seek / jump — **ignore**. A seek must not age the bone 8 s.

| Does **not** += |
|---|
| HOLD (pause, hidden, stall, swap, play-fail, seek) |
| hall breath (spawn / atA) |
| decay `kind: "decay"` (terminal net) |
| cook wait |

Idle on a **playing** sprint plate: `t_run` **does** age. Idle-decay hits `m`, it does not freeze the bone. Cut a 12 s plate at 8 s → `t_run` took ~8 s **seen**.

`t_run` **allows**. `m` **qualifies**. Neither skips the bone.

Boot / hall→Lane / end of Lane: `t_run = 0`. Howl / Recall hall: `t_run` unchanged (you left the bone). No shared `t_run` across two minutes.

### Verdict (once per cue)

| Verdict | `m` | Other |
|---|---|---|
| Hit | `min(1, m + 0.10)` | |
| Late | unchanged | `peakBan` |
| Miss / wrong side | `max(0.05, m × 0.70)` | `peakBan` |
| Early | unchanged | same cue |

Idle-decay: each 1.0 s picture-time idle → `m − 0.015` (floor 0.05). Pause does not tick. `peakBan` clears at **join** (one penance plate already picked). Boot `m = 0.12`.

### Bone permission

```
[0, 8)     Quiet   — calm only (even if m is already high)
[8, 20)    Lean    — calm or lean by m
[20, 45)   Build   — lean (peak still closed)
[45, 70]   Peak ok — peak IF m≥0.70 AND !peakBan
> 70       Close   — no peak; lean or decay
```

Peak = **permission**, not a forced clip.

```
want =
  t_run < 8                          → calm
  t_run < 20 && m < 0.30             → calm
  t_run < 45                         → lean
  t_run in [45,70] && m≥0.70 && !ban → peak
  m < 0.18                           → decay
  else                               → lean
```

Bar: ~3–4 % of 9:16, fill ∝ `m`, no flash. Bus 2 oneshot only if `!HOLD`.

### Tests

- 6 Hits before 8 s → still calm
- Cut 8 s of a 12 s plate → `t_run` += ~8, not 12
- Seek / `performance.now()` must not age the bone
- Hidden 10 s → `t_run` and `m` frozen
- Decay net must not farm toward 45 s
- `playbackRate` never ≠ 1

## Cue + HOLD

Hit `[on−0.08, off]` · Late `(off, off+C]` · `C = min(0.22, next.on−off)`. Year-0: pose, L, R, fork. Same 40/20/40.

## Hard fences

- Never `+= duration` of the file. Never `Date.now`.
- Never `playbackRate ≠ 1`. Never peak before `t_run ≥ 45`.
- One `flushOpen` per plate. `joinEnded` still first.

## One line

**`t_run` is the age of frames you actually saw on sprint reels.** `m` says if you were following. Peak needs both.
