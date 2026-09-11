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

Hall recollage **only at the edges**: enter from a citadel door (`kind: sprint`), exit to a hall, Recall / death / fail → `decay`. Not “spawn then walk-B” in the middle of the run.

If he breathes 2 s between two sprints, that is a buffer / decay / hold. Do **not** name it `breath-A`.

## Sprint law (Grok)

1. It **starts calm**. `m` low: even gait, world still asleep (little glow, short path).
2. **Hits** → `m` up → next plates livelier: faster gait, longer luminous path, the world **wakes**.
3. Miss / Late → `m` down (never 0): back toward calm / decay. No chrome game-over.
4. A tap with **no** Bolt motion in that window = dead tap. Do not count it. Do not invent an overlay action.

The player does not steer Bolt with a stick. He **matches** his tap to what Bolt *already does*.

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**  
Calm first. Success = faster, brighter. Miss = it falls asleep. Never a button without the dog.

## `m` = wake, not a combo HUD

| `m` | Film | World |
|---|---|---|
| low | calm, few cues, weak glow | asleep |
| rising | lean, denser gait, more `[on, off]` | path grows |
| high | peak **earned** | dense — still **not** a 5th door |
| falling | decay | sleeps again |

Plates 6–15 s chain ~1 min. The bone reads `m` to pick the **next** plate from **already cooked** stock (calm / lean / peak / decay). Imagine is not on the tap.

Grok does not cook “a walk-A”. He cooks a **palette** of plates tagged by intensity.

## Tap = a real action in the film

Glow is not a floating metronome. It is Bolt who: plants (or speeds up), leans L/R, crosses / jumps / ducks.

- `on` = the gesture **starts to read**
- `off` = the gesture has passed
- Hit = you tapped **with** that gesture

If Imagine did not put the gesture, you may not add a “jump” button. Recook the plate. Cue honesty: you see the action with no text. [DONT.md](DONT.md) §7.

Wrong side while Bolt leans left = Miss.  
Tap on a breath with no gesture = Idle / ignore.

## Law 0 (per plate)

Same API as the hall ([COOK.md](COOK.md)). Invert first/last → clone.

Each plate: `image` + `last_frame` of **that** plate’s stills (not spawn/atA unless this plate *is* a hall-edge enter).

Prompt = `worldLine` + `pathLine` + [CHAR.md](CHAR.md) + the **gesture**. No Hall′. No TAP stamp.

Gait: feet on the floor, lock-off, even speed, **back** (`lockoff-back-v1`). Sprint is the disc, not an excuse for ¾. [CHAR.md](CHAR.md).

Write `[on, off]` **after** the clip, on the real glow. Glow **in** the hung file, never an engine overlay.

## File Grok (do not recollate the hall)

```
identity Bolt (back / rails)
palette: calm × n, lean × n, peak, decay
each plate: 1–3 visible gestures + cues timed after the fact
m picks the next plate from the palette
Enter citadel = other job, 2nd tap, ticket
```

Not: spawn / atA / breath-A in the middle of the minute.

**Race min** (play the minute offline): enough plates for ~60 s + `decay` + cues/glow + identity thumb.

**Bridge** (optional, door handoff): the 5 hall names in [BIOMES.md](BIOMES.md). Pont. Not the design of the minute.

Cap 2 per plate. Gel ≠ PASS. Both intensity bands empty → row stays `coming`. Glow missing ×2 → do not wire cues, do not hang a hall door.

## Refuse

- a “universal” tap that scores even if Bolt does nothing
- a bar that says *when*
- live Imagine to “go faster” as `m` rises
- peak = teleport biome
- 60 s as **one** clip (no `m` steps)
- cooking `walk-spawn-A` and calling it a Lane

## One line

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**  
The hall is before / after the door. Inside the minute: plates + bone. Not a little citadel.
