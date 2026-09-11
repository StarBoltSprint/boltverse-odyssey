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

Only `running` (playing **and** `!held`) may `resolveFrame` / bump `m` / tick `t_run`. Peak does **not** raise the veil. `pickNext` only in `ended-wait`.

Races: Samsung `src=` on vis · Frost hide-before-still · coyote `Date.now` · double `flushOpen` · swap+tap · peek peak. One flush per plate.

## `m` + bone (`t_run`)

`m ∈ [0.05, 1]` — fitness / storm. Chrome name: Resonance (bar only). **One Lane minute.** Not Pack rank. Not a token.

It says *are you still following Bolt?* It does **not** say where we are in the film. That is `t_run`.

**`m` must not:** change `playbackRate` · move `on/off` / coyote · pulse the bar on the beat · skip a plate · open Hall′ / a peak-door · recook Imagine · advance during HOLD.

The current clip plays to the end. `m` acts at the **JOIN**.

### Two clocks

| | Advances when | Hold |
|---|---|---|
| `t_clip` | `currentTime` of the plate | HOLD |
| `t_run` | sum of **sprint** plate `t_clip` (not hall breath, not terminal decay) | HOLD + idle breath |

`t_run` ∈ ~0–70 s. That is the bone.

### Verdict (once per cue)

| Verdict | `m` | Other |
|---|---|---|
| Hit | `min(1, m + 0.10)` | |
| Late | unchanged | `peakBan` |
| Miss / wrong side | `max(0.05, m × 0.70)` | `peakBan` |
| Early | unchanged | same cue |

Idle-decay (no cue / Howl): each **1.0 s** picture-time idle → `m = max(0.05, m − 0.015)`. Pause does not tick.

Boot / hall→Lane: `m = 0.12`, `t_run = 0`. End of Lane / terminal decay / hall exit = reset. `peakBan` clears at **join** of the next plate (one penance plate already picked).

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

Then `pickNext(palette[want])`: other id if possible → calm → decay → hold still.

Density **in** the cooked plate: calm 1 cue · lean 1–2 · peak 2–3 · decay 0–1.

### Bar

Bottom, ~3–4 % of the 9:16, crystal. Fill ∝ `m`. **No** flash / beat / TAP. Peak permission may look denser (more facets), not an alarm. May hide for a nuder year-0 — the decree wants the bar.

Hits → denser **next** plates. Miss → world falls asleep. Never time-stretch Bolt.

Bus 1: one bed per tier, switch at join. Bus 2: Hit/Late/Miss oneshot only if `!HOLD`. Early = silence.

### Tests

- 6 Hits before 8 s → still calm plates
- Clean Hits to 50 s + `m≥0.7` → peak allowed
- Miss at 48 s → no peak this plate
- Hidden 10 s → `t_run` and `m` frozen
- Breath 8 s → `m` barely moved (~0.12)
- `playbackRate` never ≠ 1

## Cue + HOLD

Hit `[on−0.08, off]` · Late `(off, off+C]` · `C = min(0.22, next.on−off)` clamp 0.18–0.28.  
Same 40/20/40 as the hall. Year-0: pose, L, R, fork.

## Hard fences

- No TAP bar. Never `playbackRate ≠ 1`. Never live Imagine as `m` rises.
- Do not peak before `t_run ≥ 45`. Do not pickNext outside `ended-wait`.
- One `flushOpen` per plate. `joinEnded` still first.

## One line

**`m` = if you follow the dog. `t_run` = age of the storm. Peak = both.** The film only changes speed by changing reels.
