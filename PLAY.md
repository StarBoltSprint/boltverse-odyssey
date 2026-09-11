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

**Side** — not “TAP LEFT”:

- path pulls left → tap left
- Bolt leans right → tap right
- fork: two glows, you pick the arm you follow
- pose (paw strike, path still center) → tap the path / the dog’s lower third, **not** a 4th Action button

If both sides glow the same, the plate is bad. Recook. One gesture = one dominant direction.

**When** — the glow **lights** in the film = window open. It dies / the gesture is done = too late (coyote still a bit).

Calm (`m` low): one glow, slow. Wake: more often, clearer — still **read**, never announced. First plate: slow enough that “light left = finger left” needs no tutorial.

**Finger (year-0):** one **tap**, not a swipe, not a hold. One finger, glow’s side, while it is on. Hold / swipe = another `railsVersion`. Not the calm kit.

**Do not put on the 9:16:** rings, L/R buttons, the word TAP, arrows over Bolt, the `m` bar pulsing to the beat. [DONT.md](DONT.md) §7.

Optional later: two lanes at the **very bottom**, **with** the Resonance bar, never on the dog — only if playtest proves 40/20/40 + glow is not enough. That is not the default.

**Net if nobody gets it:** not a HUD. Recook: bigger glow, earlier, **one** cue on the first clips, coyote 180–280 ms. Still unreadable → decay / stock, never “tap here”.

**Hall → Lane:** he left through a **left or right** door. The first sprint plate may **continue that side** — same hand, same 40 %. No “Welcome tap left” screen.

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
- Same 40/20/40 as the hall. Letterbox = void.
- Peak is not a door and not a tap.
- Do not cook walk-A and call it a Lane.
- Hall poses do not run the middle of the minute.
- First Lane plate continues the door-hand he entered with.

## One line

**Same screen as the hall: left / right on the picture. The film says which and when — by where Bolt leans and where it shines.** The finger goes where the dog goes. If you have to write “here”, the clip is not cooked.
