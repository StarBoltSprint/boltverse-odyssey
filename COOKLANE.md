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
- a tiny “jump” with no hind-paw plant then leave — Imagine misses it, the eye too
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

1. Watch the mp4.
2. Frame where the gesture **starts to show** → `on`.
3. Frame where it is **done** → `off`.
4. Glow must be on **inside** `[on, off]`.
5. If you hesitate 300 ms, the gesture is not sharp enough → recook, do **not** widen the cue.

Hit = ≤80 ms before `on` through `off`. Coyote 180–280 ms after.

### `m` does not rename verbs

Gestures keep the same **names**. Density and amplitude change:

- calm: sparse poses, short path
- wake: closer poses, clearer lean, fork later in the bone
- peak: max path — still pose / L / R, just faster

No “super jump” unlocked by `m`. `m` picks the **next plate** (livelier), not a combo overlay.

Prompt one plate: **one** dominant gesture + worldLine.

> Bolt sprints, leans left, luminous path pulls left, no text, lock-off, back to camera.

Then list cues. If the model did not lean, you do **not** invent `lean-L` in the JSON.

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

## One line

**Pose, left, right, fork — that is all the back gives.** Each tap marries one of those four. `m` chains livelier plates. It does not add buttons.
