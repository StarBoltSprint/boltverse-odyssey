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

Aim **6 played** + **1 decay** in the fridge. `t_run` 45–70 with 10 s plates → peak around the **5th** (if Hits).

The file **changes** with `m`. Cook **more** than 6 so the picker has a drawer:

| Tier | On disk | Duration | Cues |
|---|---|---|---|
| calm | **3** | 10–15 s | 1 |
| lean | **4** | 8–12 s | 1–2 |
| peak | **2** | 8–10 s | 2–3 |
| decay | **1** | 8–12 s | 0–1 |

**Cook ≈ 10 clips** for a year-0 row. A run **plays** ~6 (re-picks calm on Miss).

Without 3 calms: at 30 s you only recycle, and it shows.

Clean file: `0–8 calm · 8–20 lean · 20–45 lean, lean · 45–60 peak`. **4–5 joins.** Miss: `calm → calm → decay → calm …` Same ~1 min, sleepier drawer — you do not add plates, you change **tier**.

Do **not:** 1×60 s (no `m` steps) · 20×3 s (flipbook, joints explode) · 1+1+1 (2nd run already seen).

## Two layers (do not mix)

| | Hall | Lane (center) |
|---|---|---|
| Clock | poses | plates 6–15 s, bone `t_run` ~60 s |
| Brick | breath / walk / still | clip + **glow** + cues |
| Graph | spawn · atA · atB | **none** |
| Next | `room.json` | `m` + `t_run` pick a **palette** |
| Speed | — | **next plate**, never `playbackRate` |

## Sprint law

**`m` = if you follow the dog. `t_run` = age of the storm. Peak = both.** Quiet [0,8s] = calm even if `m` is high.  
Year-0: **pose, L, R, fork**. Tap only if it is already in the shot. `playbackRate = 1` always.

| Gesture | Tap |
|---|---|
| Pose | path / lower-center |
| Lean L / R | left / right 40 % |
| Fork | one side; other = Miss |
| Peak | **no** peak tap — earned state |

6–15 s: **1 to 3** cues. Time `[on, off]` **after** the clip. Glow **in** the encode.

```
early_grace_s 0.08 · coyote 0.18–0.28 (default 0.22)
Hit m += 0.1 · Miss m *= 0.7 floor 0.05 + peakBan · Late peakBan
```

## Law 0 (per plate)

Same API as the hall ([COOK.md](COOK.md)). Prompt = worldLine + pathLine + CHAR + **one** gesture. Invert first/last → clone.

## File Grok

```
identity Bolt (back / rails)
palette: calm×3, lean×4, peak×2, decay×1   ← ~10 clips
each plate 6–15 s, 1–3 of {pose, L, R, fork}, cues after the fact
m + t_run pick the next   (scripts/sprint-transition.mjs)
```

Cap 2. Gel ≠ PASS. Glow missing ×2 → no cues, no hall door.

## Refuse

- TAP bar · live Imagine as `m` rises · peak as a tap / teleport
- 60 s as **one** clip · 20×3 s flipbook · 1+1+1 palette
- cook walk-A and call it a Lane · invent lean-L on a straight run
- `playbackRate ≠ 1` · write `on` before the clip exists

## One line

**A dozen clips in the oven, six on the plate.** 10–12 s each. Decay always there. Faster = the lean/peak drawer, not 30 cuts.
