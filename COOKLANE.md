# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md). Row / ids = [BIOMES.md](BIOMES.md). Play = [PLAY.md](PLAY.md).  
Runner = [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs).

**Do not cook walk-A as the sprint.** Hall poses = **bridge** at the door. The minute = plates + `m` + `t_run`.

## Count — not 60 plates

A minute is a **handful of reels**. 6–15 s, `playbackRate = 1`, join cut 0.

| Mean duration | Plates for ~60 s |
|---|---|
| 12 s | **5** |
| 10 s | **6** |
| 8 s | **7–8** |

Aim **6 played** + **1 decay** in the fridge.

Cook **more** than 6 so the picker has a drawer:

| Tier | On disk | Duration | Cues | ρ ≈ cues/s |
|---|---|---|---|---|
| calm | **3** | 10–15 s | 1 | **0.08** |
| lean | **4** | 8–12 s | 1–2 | **0.20** |
| peak | **2** | 8–10 s | 2–3 | **0.33** |
| decay | **1** | 8–12 s | 0–1 | **0–0.10** |

`ρ = (hittable cues) / duration_s`. Smoke: peak at 1 cue / 12 s = still calm. Calm at 4 cues = mash.

**Cook ≈ 10 clips.** A run **plays** ~6. Without 3 calms: at 30 s you only recycle.

Clean file: `0–8 calm · 8–20 lean · 20–45 lean · 45–60 peak`. **4–5 joins.** Miss changes **drawer**, not plate count.

Do **not:** 1×60 s · 20×3 s · 1+1+1 · `playbackRate = lerp(m)` (even ±5 % desyncs glow vs finger).

## Two layers

Hall = poses at the **door**. Lane center = plates + glow. Speed = **next plate**, never the HTML rate.

## Sprint law

**The mp4 rate = 1. The sprint rate = ρ of the next reel.**  
`m` = follow the dog. `t_run` = age of the storm. Peak = both. Quiet [0,8s] = calm even if `m` is high. Year-0: pose, L, R, fork.

```
early_grace_s 0.08 · coyote 0.18–0.28 (default 0.22)
Hit m += 0.1 · Miss m *= 0.7 floor 0.05 + peakBan
prepVideo / kick / joinEnded: playbackRate = 1   // no rate =
```

Time `[on, off]` **after** the clip. Glow **in** the encode. Law 0: first/last per [COOK.md](COOK.md).

## File Grok

```
palette: calm×3, lean×4, peak×2, decay×1   ← ~10 clips, ρ per row above
m + t_run pick the next   (scripts/sprint-transition.mjs)
```

## Refuse

- TAP bar · live Imagine · peak as a tap
- 60 s one clip · flipbook · 1+1+1
- walk-A as a Lane · `playbackRate ≠ 1` · `rate = f(m)`

## One line

**A dozen in the oven, six on the plate.** Faster = denser ρ on the next reel, not a stretched cassette.
