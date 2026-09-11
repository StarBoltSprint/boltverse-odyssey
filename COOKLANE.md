# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md). Row = [BIOMES.md](BIOMES.md). Play = [PLAY.md](PLAY.md).  
Runner = [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs).  
`L` = [scripts/cue-readability.mjs](scripts/cue-readability.mjs) — `smokeL` / `actionL`. Does not see the film.

**Do not cook walk-A as the sprint.** The minute = plates + `m` + `t_run`.

## Count — not 60 plates

6–15 s, `playbackRate = 1`. Cook ≈ **10 clips** (calm×3, lean×4, peak×2, decay×1). A run plays ~6.

## Density ρ

```
ρ      = N_cues / duration_s
ρ_glow = sum(off − on) / duration_s   // year-0 cap 0.45
```

| Palier | N | Durée | ρ | min `on→on` |
|---|---|---|---|---|
| calm | 1 | 10–15 s | **0.07–0.10** | n/a |
| lean | 1–2 | 8–12 s | **0.12–0.22** | **≥ 1.2 s** |
| peak | 2–3 | 8–10 s | **0.22–0.35** | **≥ 0.8 s** |
| decay | 0–1 | 8–12 s | **0–0.10** | — |

FAIL: N≥4 / ≤10 s · two `on` < 0.6 s · overlap · peak N=1 >12 s · `ρ_glow > 0.45`.

## Readability `L` — a vote, not a mean

3 samples → `L ∈ {0, ⅓, ⅔, 1}`. One bad sample **jumps a tier**. Prefer **false negative**. Doubt = not readable. Never average 10 visions until PASS (that *creates* FP).

```
3/3               Hang
mid NON           recook — the gesture is not there
only off NON      nudge off −2–4 frames   (keep the mp4)
only on NON       nudge on  +2–4
ambiguous L/R     recook side
```

**Gray ≠ Imagine recook.** Gray spends **no** cap-2. Recook only if **mid** is no, or ambiguous. `off` is the noisy edge — often the window, not the clip.

Do **not:** lower PASS to ship forest · tie `L` to `m` · grow coyote / `ρ_glow` to hide a hole.

## Sprint law

Mp4 rate = 1. Sprint rate = ρ of the next reel. Year-0: pose, L, R, fork. Time `[on, off]` **after** the clip.

## One line

**The middle counts, the edges lie, doubt is no.** Recale the window first. Do not lower 3/3 to calm the classifier.
