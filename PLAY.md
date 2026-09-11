# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall: menu-picture, lock-off, zero chrome. This repo’s player is **(2)** ([ENGINE.md](ENGINE.md)).

A door with `kind: sprint` ([LINKS.md](LINKS.md)) **hands off** to this disc. Cook: [COOKLANE.md](COOKLANE.md).

**The Lane is not a tiny citadel.** Center of the minute = plates + bone. Hall poses live **only at the edges**.

## Core

- Picture is the clock. Tap what Bolt *does* in the encode.
- `m` wakes the world (not XP). Glow = when. Resonance bar never says when-to-tap.

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**

## Year-0 verbs (back, 9:16)

Pose, left, right, fork. That is all the back gives. Alphabet: [COOKLANE.md](COOKLANE.md).

| Gesture | Tap |
|---|---|
| paw strike / pose | lower-center |
| lean L | left 40 % |
| lean R | right 40 % |
| fork (ground splits) | one side; other = Miss |

Peak = earned **state**, not a tap. Decay = 0 cue. Threshold = floor 3.  
1–3 cues per 6–15 s plate. More than 3 glows in 10 s = mash, FAIL honesty.

No jump / spell / combo unless it is in the paws and the glow. Yaw 40° = FAIL lock. Straight run → no L/R cue. Do not invent `lean-L` in JSON if the clip did not lean.

`m` changes **density**, not the verb names. No super-jump unlocked by `m`.

## Four nested clocks (one tap at a time)

| # | Layer | Where |
|---|---|---|
| 1 | Plate 6–15s | Lane **center** |
| 2 | Hall poses | Hall, Lane **edges** only |
| 3 | Bone ~60s (`m`) | Lane **center** — peak ≠ a 5th door |
| 4 | Citadel enter | edge |

## Picture-time

`video.currentTime` while playing. A cue at 4.2 s is 4.2 s of the **mp4**. Time cues **after** the clip, on the real glow. Hesitate 300 ms → recook, do not widen.

Hit ≤80 ms pre-`on` through `off`. Coyote 180–280 ms. Early ignore. Miss never zeros `m`. Dead tap if no gesture.

`m` picks the next cooked plate (calm / lean / peak / decay). Imagine is not on the tap.

## Hard fences

- No TAP bar. Recook glow, not UI. [DONT.md](DONT.md) §7.
- Peak is not a door and not a tap.
- Do not cook walk-A and call it a Lane.
- Hall poses do not run the middle of the minute.

## One line

**Pose, left, right, fork — that is all the back gives.** `m` chains livelier plates. It does not add buttons.
