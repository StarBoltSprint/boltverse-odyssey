# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md).  
Row / ids = [BIOMES.md](BIOMES.md). Play disc = [PLAY.md](PLAY.md).  
Runner = [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs) — judge + reel. Not Imagine.

**Do not cook walk-A as the sprint.** The hall graph (spawn / atA / breath-A) is a **bridge** at the door. The minute itself is plates + `m`.

## Two layers (do not mix)

| | Hall | Lane (center of the minute) |
|---|---|---|
| Clock | poses | plates 6–15 s chained ~**60 s** (the bone) |
| Brick | breath / walk / still | clip + **glow** + cues |
| Graph | spawn · atA · atB | **none** — no teal/gold fork required |
| Tap | walk to a door | **gesture already in the frame** |
| Next clip | edge in `room.json` | `m` picks from a **palette** |
| Speed | — | **next plate**, never `playbackRate` |

Hall recollage **only at the edges**: enter from a citadel door (`kind: sprint`), exit to a hall, Recall / death / fail → `decay`.

Player **read** (same 40/20/40, glow says which/when, first plate continues the door-hand): [PLAY.md](PLAY.md). Do not stamp TAP. If both sides glow, recook.

## Sprint law (Grok)

1. It **starts calm**. `m` low.
2. Hits → `m` up → next plates livelier.
3. Miss / Late → `m` down (never 0).
4. A tap with **no** Bolt motion in that window = dead tap.

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**  
**Speed is the next film, not the knob of the current one.** `playbackRate = 1` always.

## Year-0 gestures (back, 9:16)

Lock-off, back to camera: you do **not** have 20 readable verbs. The eye sees rump, back, paws, path, two L/R masses. Each legal tap = one of these, **already** in the shot.

| Gesture | In the film | Tap | `m` |
|---|---|---|---|
| **Pose** (paw strike) | paw plants, push | 1 tap path / lower-center | rhythm |
| **Lean L** | weight / shoulder / path pulls left | left 40 % | lean-L |
| **Lean R** | same, right | right 40 % | lean-R |
| **Fork** | ground splits, two glows | one side; other = Miss | choice |
| Threshold | oval/arch opens | 2nd tap after a lean Hit | enter arm — **floor 3** |
| Hold | gait crushes, chest low | hold or no tap (Idle) | calm / decay — later |
| Peak | longest path, world lit | **no** “peak” tap | earned **state** |

Year-0 cook: **pose, L, R, fork**. That is all the back gives.

Does **not** read (not a cue): face / gaze, a tiny “jump” with no hind-paw plant then leave, 40° yaw, fire with no light on ground or paws, a combo the clip does not have.

### One plate = few gestures

6–15 s: **1 to 3** cues. *calm* 1 pose / ~2 s. *lean* 1 L **or** R. *fork* 1 choice. *decay* 0–1. More than 3 glows in 10 s = mash.

### Time the cue **after** the clip

Never write `on: 3.0` then ask Imagine to match.

```
1. Clip PASS (lock, back, plate)
2. Scrub frame by frame
3. Mark times
4. Playtest 5 taps
5. Recook the glow if you would have to widen too much
```

`on` = first readable frame of the **gesture**. `off` = last frame of **this** gesture. Glow 1.2 s / net 0.4 s → window = the **gesture**.

| Plate | `[on, off]` |
|---|---|
| calm | **350–550 ms** |
| lean | **280–400 ms** |
| peak | **220–320 ms** |
| < 180 ms | almost never |

Nudge **2–4 frames**, not 0.5 s. Hesitate 300 ms → recook, do **not** widen.

### Frozen (smoke.json Lane + runner)

```
early_grace_s:     0.08
coyote_min_s:      0.18
coyote_max_s:      0.28
cue_min_s:         0.22
cue_max_s:         0.55
min_gap_on_to_on:  coyote + 0.05
playbackRate:      1

m 0–0.3            tier calm
m 0.3–0.7          tier lean
m ≥ 0.7            tier peak (if not peakBan)
Hit                m += 0.1
Miss               m *= 0.7   floor 0.05  + peakBan
Late               m unchanged, peakBan
miss_exit          3  → leave the minute (hall), no Game Over
```

Calm may sit at cue max. Peak at min. `cue_max > 0.55` = honesty FAIL.

`m` does **not** change coyote or the 80 ms. `m` picks a plate already timed tighter.

### `m` does not rename verbs

Prompt one plate: **one** dominant gesture + worldLine. If the model did not lean, do **not** invent `lean-L`. If both sides glow, recook.

Hall → Lane: first plate may **continue the door-hand**.

## Palette (cook this, runner only picks)

```
calm × n     slow, 1 cue, short path
lean × n     denser, L or R
peak         max wake
decay        net, world falling asleep, 0 cue
```

Imagine cooks these **before**. The Lane runner is `next = palette[tier(m)]`. Not a cook at the tap. Not `playbackRate`.

## Law 0 (per plate)

Same API as the hall ([COOK.md](COOK.md)). Invert first/last → clone.

Prompt = `worldLine` + `pathLine` + [CHAR.md](CHAR.md) + **one** gesture. No Hall′. No TAP stamp. Back, lock-off.

Write `[on, off]` **after** the clip, on the real glow. Glow **in** the hung file.

## File Grok

```
identity Bolt (back / rails)
palette: calm × n, lean × n, peak, decay
each plate: 1–3 of {pose, L, R, fork} + cues timed after the fact
m picks the next plate  (scripts/sprint-transition.mjs)
Enter citadel = other job, 2nd tap, ticket
```

Not: spawn / atA / breath-A in the middle of the minute.

**Race min:** enough plates for ~60 s + `decay` + cues/glow + identity.  
**Bridge:** hall names in [BIOMES.md](BIOMES.md) — pont, not the minute.

Cap 2. Gel ≠ PASS. Glow missing ×2 → no cues, no hall door.

## Refuse

- a tap that scores if Bolt does nothing
- a bar that says *when*
- live Imagine as `m` rises
- peak = teleport / a tap named peak
- 60 s as **one** clip (no `m` steps)
- cooking walk-A and calling it a Lane
- inventing lean-L when the clip runs straight
- both sides glowing the same
- writing `on` before the clip exists
- widening `[on, off]` past `cue_max_s`
- `video.playbackRate ≠ 1` to “reward” a Hit
- seek to the “fast end” of the same clip

## One line

**Speed is the next film, not the knob of the current one.** Hit → an already livelier plate. Miss → an already sleepier one. Bolt is never time-stretched.
