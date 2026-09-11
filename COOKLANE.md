# COOKLANE — the sprint minute, not a tiny citadel

Hall cook = [COOKROOM.md](COOKROOM.md).  
Row / ids = [BIOMES.md](BIOMES.md). Play disc = [PLAY.md](PLAY.md).

**Do not cook walk-A as the sprint.** The hall graph (spawn / atA / breath-A) is a **bridge** at the door. The minute itself is plates + `m`.

## Two layers (do not mix)

| | Hall | Lane (center of the minute) |
|---|---|---|
| Clock | poses | plates 6–15 s chained ~**60 s** (the bone) |
| Brick | breath / walk / still | clip + **glow** + cues |
| Graph | spawn · atA · atB | **none** — no teal/gold fork required |
| Tap | walk to a door | **gesture already in the frame** |
| Next clip | edge in `room.json` | `m` picks from a **palette** |

Hall recollage **only at the edges**: enter from a citadel door (`kind: sprint`), exit to a hall, Recall / death / fail → `decay`.

Player **read** (same 40/20/40, glow says which/when, first plate continues the door-hand): [PLAY.md](PLAY.md). Do not stamp TAP. If both sides glow, recook.

## Sprint law (Grok)

1. It **starts calm**. `m` low.
2. Hits → `m` up → next plates livelier.
3. Miss / Late → `m` down (never 0).
4. A tap with **no** Bolt motion in that window = dead tap.

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**

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

Does **not** read (not a cue):

- face / gaze (we are back)
- a tiny “jump” with no hind-paw plant then leave
- 40° yaw (profile = FAIL lock)
- fire / spell with no light **on the ground or paws**
- a double-tap combo the clip does not have

A jump exists only if the hindquarters **sink then leave**, glow on that window. Else it is a word in the prompt, not a gesture.

### One plate = few gestures

6–15 s: **1 to 3** cues, not a piano score.

- *calm* — 1 pose every ~2 s, same path side
- *lean* — 1 lean L **or** R, maybe a pose before
- *fork* — 1 L/R choice, short coyote
- *decay* — 0 cue (Idle) or 1 weak pose

More than 3 glows in 10 s: the player mashes, Bolt is no longer read.

### Time the cue **after** the clip

Never write `on: 3.0` then ask Imagine to match.

```
1. Clip PASS (lock, back, plate)
2. Scrub frame by frame
3. Mark times
4. Playtest 5 taps
5. Recook the glow if you would have to widen too much
```

```
t_see   = first frame “I see L or the pose”
t_end   = last frame “it is still that”
on      = t_see
off     = t_end
hit_pre = on - 0.08
coyote  = clamp(0.18 … 0.28)
```

`on` = first readable frame of the **gesture**, not start of shot.  
`off` = last frame of **this** gesture, not “he finished running”, not end of mp4.  
Glow 1.2 s / net gesture 0.4 s → window = the **gesture**. Else Hit farm.

| Plate | `[on, off]` |
|---|---|
| calm | **350–550 ms** |
| lean | **280–400 ms** |
| peak | **220–320 ms** |
| < 180 ms | almost never |

Playtest: all Early → `on` too late. All Late → `off` too soon. Hits without looking → too wide. Nobody finds the side → recook the lean. Nudge **2–4 frames**, not 0.5 s.

If you hesitate 300 ms, recook. Do **not** widen the cue.

### Frozen (smoke.json Lane)

```
early_grace_s:     0.08
coyote_min_s:      0.18
coyote_max_s:      0.28
cue_min_s:         0.22
cue_max_s:         0.55
min_gap_on_to_on:  coyote + 0.05
```

Calm may sit at max. Peak at min. `cue_max > 0.55` = honesty FAIL (player mashes the glow).

`m` does **not** change coyote or the 80 ms. `m` picks a plate already timed tighter. A calm plate is a **slower gesture in the picture**, so `t_end - t_see` is already larger.

Traps: time to audio (there is none / bus 2 is after). Copy times from another clip. `off` = end of mp4 “just in case”. Four cues 0.3 s apart (no clean coyote).

### `m` does not rename verbs

Gestures keep the same **names**. Density and amplitude change. No “super jump” unlocked by `m`.

Prompt one plate: **one** dominant gesture + worldLine.

> Bolt sprints, leans left, luminous path pulls left, no text, lock-off, back to camera.

Then list cues. If the model did not lean, you do **not** invent `lean-L` in the JSON. If both sides glow, recook.

Hall → Lane: first plate may **continue the door-hand**. No tutorial screen.

## `m` = wake, not a combo HUD

| `m` | Film | World |
|---|---|---|
| low | calm, few cues, weak glow | asleep |
| rising | lean, denser gait, more `[on, off]` | path grows |
| high | peak **earned** | dense — still **not** a 5th door |
| falling | decay | sleeps again |

Plates 6–15 s chain ~1 min. Imagine is not on the tap.

## Law 0 (per plate)

Same API as the hall ([COOK.md](COOK.md)). Invert first/last → clone.

Prompt = `worldLine` + `pathLine` + [CHAR.md](CHAR.md) + **one** gesture. No Hall′. No TAP stamp. Back, lock-off.

Write `[on, off]` **after** the clip, on the real glow. Glow **in** the hung file.

## File Grok

```
identity Bolt (back / rails)
palette: calm × n, lean × n, peak, decay
each plate: 1–3 of {pose, L, R, fork} + cues timed after the fact
m picks the next plate
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
- 60 s as **one** clip
- cooking walk-A and calling it a Lane
- inventing lean-L when the clip runs straight
- both sides glowing the same
- writing `on` before the clip exists
- widening `[on, off]` past `cue_max_s` to “make it playable”

## One line

**`on` = I see the gesture, `off` = it is done, +0.2 s grace, −80 ms anticipation.** If you have to open wider for it to play, recook the dog. You do not relax the law.
