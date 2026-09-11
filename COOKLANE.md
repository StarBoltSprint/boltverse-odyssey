# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md). Row = [BIOMES.md](BIOMES.md). Play = [PLAY.md](PLAY.md).  
Runner = [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs).

**Do not cook walk-A as the sprint.** The minute = plates + `m` + `t_run`.

## Count — not 60 plates

6–15 s, `playbackRate = 1`, join cut 0. Aim **6 played** + **1 decay**. Cook ≈ **10 clips** (calm×3, lean×4, peak×2, decay×1). A run plays ~6. 1×60 s / 20×3 s / 1+1+1 = refuse.

## Density ρ — finger load, not stride speed

```
ρ      = N_cues / duration_s          // how often it asks
ρ_glow = sum(off − on) / duration_s  // how long the path is lit
```

A calm where he already runs hard with **1** glow = ρ low, film alive. OK. `m` wakes by **more taps**, not a blurrier dog.

If `ρ_glow ≈ 1` the plate is one continuous glow → Hit farm. Aim `ρ_glow` **0.15–0.35**.

Windows must be **disjoint** after coyote cut. Two cues overlapping → ρ lies → Smoke FAIL.

| Palier | N | Durée | ρ | min `on→on` |
|---|---|---|---|---|
| calm | 1 | 10–15 s | **0.07–0.10** | n/a |
| lean | 1–2 | 8–12 s | **0.12–0.22** | **≥ 1.2 s** |
| peak | 2–3 | 8–10 s | **0.22–0.35** | **≥ 0.8 s** |
| decay | 0–1 | 8–12 s | **0–0.10** | — |

Mechanical floor: `on_{i+1} − on_i` ≥ coyote + 0.05 (~0.25 s). In practice **0.8 s+** or the eye cannot chain two leans.

`ρ > 0.40` on lock-off back = tapping, not reading Bolt.  
`ρ < 0.05` except decay = they forget it is a sprint.

Allowed density follows the **bone**. Served density = `min(os, m)`. Quiet 0–8 s cannot serve peak ρ even if `m` is high.

Clean ~60 s ≈ **8–9 cues / minute**, not 40 notes.

### Playtest (calibrate ρ, not C)

- Hits without looking → `ρ_glow` too high or windows too wide
- Miss « I didn’t see » → ρ OK, glow weak / gesture not back-readable
- Early streak → plates too dense, `on` too soon after the last
- Calm boredom → **lengthen** the clip, do not add a 2nd cue

### Smoke density (chart honesty, not Hamming)

```
FAIL  N ≥ 4 on ≤ 10 s
FAIL  two on < 0.6 s
FAIL  sum(off−on) > 0.45 * duration     // plate « lit »
FAIL  overlapping windows after coyote
FAIL  peak plate with N=1 and duration > 12 s
```

## Sprint law

**The mp4 rate = 1. The sprint rate = ρ of the next reel.**  
`m` = follow the dog. `t_run` = age of the storm. Peak = both. Year-0: pose, L, R, fork.

```
early_grace_s 0.08 · coyote 0.18–0.28 (default 0.22)
Hit m += 0.1 · Miss m *= 0.7 floor 0.05 + peakBan
kick / joinEnded: playbackRate = 1
```

Time `[on, off]` **after** the clip. Glow **in** the encode. Law 0: [COOK.md](COOK.md).

## Refuse

TAP bar · live Imagine · peak as a tap · `rate = f(m)` · walk-A as a Lane · two cues at once.

## One line

**ρ calm ≈ one gesture / 12 s; peak ≈ one / 3 s; never two at once.** Past that it is tap-tap. Below (except decay) it is not a sprint.
