# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall: menu-picture, lock-off, zero chrome. This repo’s player is **(2)** ([ENGINE.md](ENGINE.md)).

A door with `kind: sprint` ([LINKS.md](LINKS.md)) **hands off** to this disc. Cook: [COOKLANE.md](COOKLANE.md).  
Runner: [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs) — reel picker + tap judge. Not Imagine.

**The Lane is not a tiny citadel.** Center of the minute = plates + bone. Hall poses live **only at the edges**.

## Core

- Picture is the clock. Tap what Bolt *does* in the encode.
- `m` wakes the world (not XP). Glow = when. Resonance bar never says when-to-tap.

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**

**Speed is the next film, not the knob of the current one.** `playbackRate = 1` on a hung plate. Always. Else every `on/off` slides.

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

**Side** — path pulls left → tap left. Bolt leans right → tap right. Fork: pick the arm. Pose → tap the path, **not** a 4th Action button. Both sides glow → recook.

**When** — glow lights = window open. **Finger (year-0):** one **tap**, not a swipe, not a hold.

**Do not put on the 9:16:** rings, L/R buttons, TAP, arrows over Bolt, the `m` bar pulsing to the beat. [DONT.md](DONT.md) §7.

**Hall → Lane:** first sprint plate may **continue the door-hand**. No welcome screen.

## Cue window (on the gesture, then tighten)

You do **not** set `on: 3.0` then ask Imagine to match. Clip PASS first. Then scrub. Then playtest. If you must *widen* too much, recook the **glow / dog**, not the law. Numbers: [COOKLANE.md](COOKLANE.md).

```
         Early ignore        Hit              Coyote
    |------------------|-------------|----------|
                  on              off        off+c
```

- **`on`** = first frame the gesture *reads*. Not the start of the shot.
- **`off`** = last frame it is still *this* gesture. Not end of mp4.
- **Coyote** = grace **after** `off` (180–280 ms). The brain is late, not the film. Cuts at the next `on`.
- **Early** = tap before `on − 80 ms` → ignore (no farm).
- **Hit pre-`on`** = only those **80 ms** just before `on`.

| Plate | Gesture window |
|---|---|
| calm | **350–550 ms** |
| lean | **280–400 ms** |
| peak | **220–320 ms** |
| < 180 ms | almost never — mash |

Glow 1.2 s, net gesture 0.4 s → `[on, off]` = the **gesture**. `m` does **not** change coyote or the 80 ms.

## Reel (not the cassette knob)

You do **not** speed up the mp4 in play like a tape. You change **which plate comes next**, and how awake it already is.

```
timeupdate (currentTime)
  gradeTap → hit / late / miss / early / idle
  applyVerdict → m, tier, peakBan
ended(plate)
  pickNext(palette, state)
  planSwap → kick hid (ENGINE), fade 0, still first
  hid not ready → hold / decay, taps live, no black hole
```

Palette **already cooked**: calm × n, lean × n, peak, decay.

| Verdict | `m` | Next |
|---|---|---|
| Hit | `+= 0.1` | higher tier |
| Miss | `× 0.7`, floor `0.05`, `peakBan` | lower / decay |
| Late | unchanged, `peakBan` | no peak |
| Early / idle | unchanged | same |

Tiers: `0–0.3` calm · `0.3–0.7` lean · `≥0.7` peak (if not banned).

“Faster” in the picture = **gestures more often** + a brighter world. Not `playbackRate = 1.4` on the same shot.

| `m` | Next plate |
|---|---|
| low | longer shots, 1 pose, weak glow |
| mid | stride already bigger, cue ~1 s, clear lean |
| high | shorter clips (still 6–15 s), 2–3 cues, long path |
| falling | decay: less glow, gait crushes, 0–1 cue |

**Do not:** `playbackRate` as a reward, recook the next plate on tap, seek to the “fast end”, one 60 s band whose speed you change.

`pickNext`: same tier, other id if possible; else calm; else decay; else hold.  
3 Hits in a row → you **see** the next tier. 2 Miss → you drop. Repeated miss → **exit** the minute (hall), not a Game Over screen.

### Joints

- last still / last frame of A ≈ first of B (same rails, same back)
- cut 0 or short dissolve **if** the dog did not jump place
- dual-video: load B in hid **during** A (stock, not cook)
- B not ready → decay, clock hold, never a spinner
- one `src=` on vis = the Samsung clone — same as hall, **don't**
- `planSwap` does **not** touch the DOM. ENGINE paints: still → hid `play()` → paint if `paused === false` → hide vis
- `m` high does **not** allow a black hole “generating faster world”

Slowing is not elegant slow-mo. It is decay / calm, fewer cues, path pulling back. Bolt still runs, less awake.

## Four nested clocks (one tap at a time)

| # | Layer | Where |
|---|---|---|
| 1 | Plate 6–15s | Lane **center** |
| 2 | Hall poses | Hall, Lane **edges** only |
| 3 | Bone ~60s (`m`) | Lane **center** — peak ≠ a 5th door |
| 4 | Citadel enter | edge |

## Picture-time

`video.currentTime` while playing. A cue at 4.2 s is 4.2 s of the **mp4**. `playbackRate = 1`.

Imagine is not on the tap. Runner: [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs).

## Hard fences

- No TAP bar. Recook glow, not UI. [DONT.md](DONT.md) §7.
- Same 40/20/40 as the hall. Letterbox = void.
- Peak is not a door and not a tap.
- Do not cook walk-A and call it a Lane.
- Hall poses do not run the middle of the minute.
- First Lane plate continues the door-hand he entered with.
- Do not widen `[on, off]` to “make it playable” — recook the dog.
- **Never** `playbackRate ≠ 1`. Never live Imagine as `m` rises.

## One line

**Speed is the next film, not the knob of the current one.** Hit → an already livelier plate. Miss → an already sleepier one. Bolt is never time-stretched; the world changes reels.
