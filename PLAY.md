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
| paw strike / pose | lower-center / on the path |
| lean L | left 40 % |
| lean R | right 40 % |
| fork (ground splits) | one side; other = Miss |

Peak = earned **state**, not a tap. Decay = 0 cue. Threshold = floor 3.  
1–3 cues per 6–15 s plate. More than 3 glows in 10 s = mash, FAIL honesty.

No jump / spell / combo unless it is in the paws and the glow. Yaw 40° = FAIL lock. Straight run → no L/R cue. Do not invent `lean-L` in JSON if the clip did not lean.

`m` changes **density**, not the verb names. No super-jump unlocked by `m`.

## How the player knows (no second map)

He does **not** learn a button. He reads it like the hall: **the picture + the same 40 / 20 / 40**.

Hits are on `containPlate` — the 9:16 rectangle, not the letterbox. Letterbox tap = void.

```
left   40 %   →  A / lean L / fork L
center 20 %   →  miss (except pose / path dead-center)
right  40 %   →  B / lean R / fork R
```

Teal / gold doors in the hall = the **same hands** on the Lane. No new grid.

**Side** — not “TAP LEFT”: path pulls left → tap left. Bolt leans right → tap right. Fork: two glows, pick the arm. Pose → tap the path, **not** a 4th Action button.

If both sides glow the same, recook. One gesture = one dominant direction.

**When** — glow lights = window open. Dies / gesture done = too late (coyote still a bit). First plate slow enough that “light left = finger left” needs no tutorial.

**Finger (year-0):** one **tap**, not a swipe, not a hold. Hold / swipe = another `railsVersion`.

**Do not put on the 9:16:** rings, L/R buttons, TAP, arrows over Bolt, the `m` bar pulsing to the beat. [DONT.md](DONT.md) §7.

**Net:** recook bigger / earlier glow, **one** cue on first clips. Still unreadable → decay / stock, never “tap here”.

**Hall → Lane:** first sprint plate may **continue the door-hand**. No welcome screen.

## Cue window (on the gesture, then tighten)

You do **not** set `on: 3.0` then ask Imagine to match. Clip PASS first. Then scrub. Then playtest. If you must *widen* too much, recook the **glow / dog**, not the law. Numbers: [COOKLANE.md](COOKLANE.md).

```
         Early ignore        Hit              Coyote
    |------------------|-------------|----------|
                  on              off        off+c
```

- **`on`** = first frame the gesture *reads* (path pull, paw strike, weight left). Not the start of the shot.
- **`off`** = last frame it is still *this* gesture (weak glow OK). Not “he finished running”. Not end of mp4.
- **Coyote** = grace **after** `off` (180–280 ms). The brain is late, not the film. Cuts at the next `on`.
- **Early** = tap before `on − 80 ms` → ignore (no farm).
- **Hit pre-`on`** = only those **80 ms** just before `on`.

Two cues packed tight = coyote dies + Early/Hit mush → too many cues.

| Plate | Gesture window |
|---|---|
| calm | **350–550 ms** |
| lean | **280–400 ms** |
| peak | **220–320 ms** |
| < 180 ms | almost never — mash |

Glow in the film 1.2 s, net gesture 0.4 s → `[on, off]` = the **gesture**, not the whole glow. Else Hit farm.

Playtest 5 taps: all Early → `on` too late. All Late → `off` too soon / coyote short. Hits without looking → window too wide. Nobody finds the side → recook the lean, not the ms. Nudge `on/off` **2–4 frames**, not 0.5 s.

`m` does **not** change coyote or the 80 ms. `m` picks a plate already timed tighter.

## Four nested clocks (one tap at a time)

| # | Layer | Where |
|---|---|---|
| 1 | Plate 6–15s | Lane **center** |
| 2 | Hall poses | Hall, Lane **edges** only |
| 3 | Bone ~60s (`m`) | Lane **center** — peak ≠ a 5th door |
| 4 | Citadel enter | edge |

## Picture-time

`video.currentTime` while playing. A cue at 4.2 s is 4.2 s of the **mp4**.

`m` picks the next cooked plate (calm / lean / peak / decay). Imagine is not on the tap.

## Hard fences

- No TAP bar. Recook glow, not UI. [DONT.md](DONT.md) §7.
- Same 40/20/40 as the hall. Letterbox = void.
- Peak is not a door and not a tap.
- Do not cook walk-A and call it a Lane.
- Hall poses do not run the middle of the minute.
- First Lane plate continues the door-hand he entered with.
- Do not widen `[on, off]` to “make it playable” — recook the dog.

## One line

**`on` = I see the gesture, `off` = it is done, +0.2 s grace, −80 ms anticipation.** If you have to open wider for it to play, recook the dog. You do not relax the law. The finger goes where the dog goes.
