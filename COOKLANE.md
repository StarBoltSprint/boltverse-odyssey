# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md). Row = [BIOMES.md](BIOMES.md). Play = [PLAY.md](PLAY.md).  
Runner = [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs).  
`L` = [scripts/cue-readability.mjs](scripts/cue-readability.mjs) — `smokeL`. Does not see the film.

**Do not cook walk-A as the sprint.** The minute = plates + `m` + `t_run`.

## Count — not 60 plates

6–15 s, `playbackRate = 1`, join cut 0. Aim **6 played** + **1 decay**. Cook ≈ **10 clips** (calm×3, lean×4, peak×2, decay×1). A run plays ~6.

## Density ρ

```
ρ      = N_cues / duration_s
ρ_glow = sum(off − on) / duration_s   // year-0 cap 0.45; later 0.30 peak / 0.20 calm
```

| Palier | N | Durée | ρ | min `on→on` |
|---|---|---|---|---|
| calm | 1 | 10–15 s | **0.07–0.10** | n/a |
| lean | 1–2 | 8–12 s | **0.12–0.22** | **≥ 1.2 s** |
| peak | 2–3 | 8–10 s | **0.22–0.35** | **≥ 0.8 s** |
| decay | 0–1 | 8–12 s | **0–0.10** | — |

FAIL: N≥4 / ≤10 s · two `on` < 0.6 s · overlap · peak N=1 >12 s · `ρ_glow > 0.45`.

## Readability `L` — year-0 guard, not a lab

3 samples → `L` can only be **0, 1/3, 2/3, 1**. `0.75` meant **3/3**. Write that.

```
L_PASS = 3/3     Hang honesty
L_GRAY = 2/3     nudge on/off 2–4 frames (gesture is there, window is wrong)
FAIL   = 0 or 1/3  recook — even the middle of the cue does not read
```

Code: `smokeL` (`L_PASS = 1`, `L_GRAY = 0.5`). Ambiguous L/R → 0. Decay 0 cue → `L.na`.

Do **not:** lower PASS to 0.50 to ship forest · tie `L` to `m` · grow coyote to hide a hole.

Coyote is **outside** `L`. **No ring if `L` is low.**

## Sprint law

Mp4 rate = 1. Sprint rate = ρ of the next reel. Year-0: pose, L, R, fork.  
`Hit m += 0.1` · `Miss × 0.7` floor 0.05. Time `[on, off]` **after** the clip.

## One line

**With 3 photos, readable = all three. Two = move the window. One = recook.**  
0.75 is not science. It is « no hole in the chart ».
