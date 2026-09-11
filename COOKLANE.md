# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md). Row = [BIOMES.md](BIOMES.md). Play = [PLAY.md](PLAY.md).  
Runner = [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs).

**Do not cook walk-A as the sprint.** The minute = plates + `m` + `t_run`.

## Count — not 60 plates

6–15 s, `playbackRate = 1`, join cut 0. Aim **6 played** + **1 decay**. Cook ≈ **10 clips** (calm×3, lean×4, peak×2, decay×1). A run plays ~6. 1×60 s / 20×3 s / 1+1+1 = refuse.

## Density ρ — finger load, not stride speed

```
ρ      = N_cues / duration_s
ρ_glow = sum(off − on) / duration_s   // aim 0.15–0.35; ≈1 = farm
```

Windows **disjoint**. Two cues overlapping → Smoke FAIL.

| Palier | N | Durée | ρ | min `on→on` |
|---|---|---|---|---|
| calm | 1 | 10–15 s | **0.07–0.10** | n/a |
| lean | 1–2 | 8–12 s | **0.12–0.22** | **≥ 1.2 s** |
| peak | 2–3 | 8–10 s | **0.22–0.35** | **≥ 0.8 s** |
| decay | 0–1 | 8–12 s | **0–0.10** | — |

`ρ > 0.40` = tapping. `ρ < 0.05` except decay = not a sprint. Quiet cannot serve peak ρ. Clean minute ≈ **8–9 cues**.

### Smoke density

```
FAIL  N ≥ 4 on ≤ 10 s
FAIL  two on < 0.6 s
FAIL  sum(off−on) > 0.45 * duration
FAIL  overlapping windows
FAIL  peak with N=1 and duration > 12 s
```

## Readability `L` — the cue must still be the film

Not « pretty clip ». **Does gesture + glow occupy the window we declared.**

```
L_i = T_readable / (off − on)
L   = Σ T_readable / Σ (off − on)
```

`T_readable` = time in `[on, off]` where **both**: (1) the gesture classifies in a blink, back visible (pose / L / R / fork) (2) glow on the **right side**, large enough, not under the dog, not dust.

Lisibility ≠ density. Dense + `L` rotten = glows everywhere, zero gesture.

Kills `L`: glow 1 s / lean 4 frames · glow late · yaw 40 · both sides shine (`L = 0`) · glow glued to the 3–4 % bar · path center vs tap left.

| `L` | Verdict |
|---|---|
| ≥ **0.75** | PASS honesty |
| 0.55–0.75 | gray: nudge `on/off` 2–4 frames, then recook |
| < **0.55** | FAIL `cue.honesty` — do not Hang |
| L/R ambiguous | FAIL now, `L` forced 0 |

Year-0: **3 frames** in `[on, off]` (start, mid, end). Gesture + glow side yes/no. `T_readable ≈ (n_yes / 3) × (off − on)`. No classifier.

Coyote is **outside** `L` (gesture dead, finger grace). Decay 0 cue: `L` N/A, not an honesty FAIL.

ρ high + `L` low = tapping. ρ low + `L` high = perfect calm. Late mass but `L` high to `off` → coyote. `L` dies before `off` → wrong `off`.

**No ring if `L` is low.** Recook or nudge. Chrome is not in the numerator.

## Sprint law

**The mp4 rate = 1. The sprint rate = ρ of the next reel.** `L` says the chart is real. Year-0: pose, L, R, fork.

```
early_grace_s 0.08 · coyote 0.18–0.28
Hit m += 0.1 · Miss m *= 0.7 floor 0.05 + peakBan
kick / joinEnded: playbackRate = 1
```

Time `[on, off]` **after** the clip. Glow **in** the encode. Law 0: [COOK.md](COOK.md).

## Refuse

TAP bar · live Imagine · peak as a tap · `rate = f(m)` · walk-A as a Lane · two cues at once · Hang a plate with `L < 0.55`.

## One line

**`L` = fraction of the window where you still see the gesture and the right glow.** Above ~0.75 you have a chart. Below you have timestamps on a mute film.
