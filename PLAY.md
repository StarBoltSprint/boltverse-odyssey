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

**Speed is the next film, not the knob of the current one.** `playbackRate = 1` always.

## Year-0 verbs (back, 9:16)

Pose, left, right, fork. Alphabet: [COOKLANE.md](COOKLANE.md).

| Gesture | Tap |
|---|---|
| paw strike / pose | lower-center / on the path |
| lean L | left 40 % |
| lean R | right 40 % |
| fork (ground splits) | one side; other = Miss |

Peak = earned **state**, not a tap. Decay = 0 cue. Threshold = floor 3.  
1–3 cues per 6–15 s plate. More than 3 glows in 10 s = mash, FAIL honesty.

Straight run → no L/R cue. Do not invent `lean-L` if the clip did not lean. `m` changes **density**, not the verb names.

## How the player knows (no second map)

Same **40 / 20 / 40** as the hall on `containPlate`. Letterbox = void. First Lane plate may continue the door-hand. No TAP stamp. [DONT.md](DONT.md) §7.

## Cue window + coyote

You do **not** set `on: 3.0` then ask Imagine to match. Clip PASS → scrub → playtest. Widen too much → recook the **dog**, not the law.

```
         Early ignore        Hit              Late (coyote)
    |------------------|-------------|----------|
                  on              off        off+C
```

```
Hit     = [on − 0.08 , off]
Late    = (off , off + C]
Miss    = tap after off+C  OR  no tap when t > off+C
Early   = tap < on − 0.08   (ignore, cue stays open)
```

**Coyote is a tail of grace after `off`.** The gesture is dead in the film; the finger may still arrive a bit late. It is **Late**, not a second Hit (`m` unchanged, peakBan). If you push `off` 220 ms later, you still score **Hit** on a dead gesture — farm. The tail is rhythm, not a longer glow.

`C` = media seconds (`currentTime`), not wall clock.

```
C = clamp(0.18, 0.28, 0.22)          // default 220 ms
C = min(C, next.on − off)            // next on cuts the grace
```

One constant per `railsVersion`, not per plate. `m` does **not** widen it.

Two cues 120 ms apart = tiny coyote. Too tight: recook / fewer cues. Do **not** raise `C` to 400 ms.

Resolve **in order**: close cue `i` (coyote) **then** read a tap as Early of `i+1`. One verdict **once**. Not Hit at `off−10ms` then Late in the tail.

| ms | ~frames @ 24fps |
|---|---|
| 80 (early grace) | ~2 |
| 180 | ~4 |
| 220 | ~5 |
| 280 | ~7 |

Under 4 frames, Late almost never exists (everyone Miss). Over 7, Late *feels* like Hit — `m` would lie if Late added `m`.

**Playtest:** too many Late, few Hit → `off` too soon — nudge `off` **2 frames**, not `C`. Too many “I tapped” Miss → `C` to 0.26 or plate too short. Hits while looking away → `off` too late, not the coyote.

What does **not** compute `C`: ping / frame drop (picture-time only; a jump past `off+C` = Miss, hard, honest). `playbackRate ≠ 1` (forbidden). Difficulty `m` (next plate is tighter **in the image**, same `C`).

| Plate | Gesture window `[on, off]` |
|---|---|
| calm | **350–550 ms** |
| lean | **280–400 ms** |
| peak | **220–320 ms** |
| < 180 ms | almost never — mash |

Glow 1.2 s, net gesture 0.4 s → window = the **gesture**.

## Reel (not the cassette knob)

```
timeupdate (currentTime)
  gradeTap / gradeClock → hit / late / miss / early / idle
  applyVerdict → m, tier, peakBan
ended(plate)
  pickNext → planSwap → ENGINE hid (playbackRate = 1)
  hid not ready → hold / decay
```

| Verdict | `m` | Next |
|---|---|---|
| Hit | `+= 0.1` | higher tier |
| Miss | `× 0.7`, floor `0.05`, `peakBan` | lower / decay |
| Late | unchanged, `peakBan` | no peak |
| Early / idle | unchanged | same |

Tiers: `0–0.3` calm · `0.3–0.7` lean · `≥0.7` peak (if not banned).  
Repeated miss → **exit** the minute (hall), not Game Over.

Joints: last A ≈ first B. Dual-video load B **during** A. One `src=` on vis = Samsung clone — don't. `planSwap` does not touch the DOM.

## Hard fences

- No TAP bar. Recook glow, not UI.
- Same 40/20/40 as the hall.
- Peak is not a door and not a tap.
- Never `playbackRate ≠ 1`. Never live Imagine as `m` rises.
- Do not widen `[on, off]` or `C` to “make it playable” — recook the dog.
- Do not cook walk-A and call it a Lane.

## One line

**Hit while the gesture lives; 0.22 s after, it is Late; then Miss; the next `on` cuts the grace.** The coyote catches the finger, not the clip. Speed is the next film.
