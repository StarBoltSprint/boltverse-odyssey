# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall: menu-picture, lock-off, zero chrome. This repo’s player is **(2)** ([ENGINE.md](ENGINE.md)).

A door with `kind: sprint` ([LINKS.md](LINKS.md)) **hands off** to this disc. Cook: [COOKLANE.md](COOKLANE.md).  
Clock: [scripts/cue-coyote.mjs](scripts/cue-coyote.mjs) — `makeSheet` / `resolveFrame` / `flushOpen`.  
Reel: [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs) — `m` + `pickNext`. Not Imagine.

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

Same **40 / 20 / 40** as the hall on `containPlate`. Letterbox = void. First Lane plate may continue the door-hand. No TAP stamp. [DONT.md](DONT.md) §7. Tap token: `A` | `B` | `pose`.

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
Early   = tap < on − 0.08   (ignore, SAME cue)
wait    = still in Hit or coyote, no tap
```

**Coyote is a tail of grace after `off`.** Late, not a second Hit (`m` unchanged, peakBan). `C` = media seconds.

```
C = clamp(0.18, 0.28, 0.22)
C = min(C, next.on − off)
```

`m` does **not** widen `C`. Two cues 120 ms apart = recook, do not raise `C` to 400 ms.

One verdict **once**. Close `i` then Early of `i+1`.

**ended:** `flushOpen(sheet, duration)` — a cue still open is **Miss**, not eternal wait. That is why the clock is its own file.

**Playtest:** too many Late → nudge `off` 2 frames, not `C`.

| Plate | `[on, off]` |
|---|---|
| calm | **350–550 ms** |
| lean | **280–400 ms** |
| peak | **220–320 ms** |

## Reel (not the cassette knob)

```
timeupdate
  sheet.t = currentTime; sheet.tap = lastTap; lastTap = null
  sheet = resolveFrame(sheet)
  if (verdict && verdict !== "wait" && verdict !== "early") applyVerdict
ended
  sheet = flushOpen(sheet, duration)
  pickNext → planSwap → ENGINE hid (playbackRate = 1)
```

| Verdict | `m` | Next |
|---|---|---|
| Hit | `+= 0.1` | higher tier |
| Miss | `× 0.7`, floor `0.05`, `peakBan` | lower / decay |
| Late | unchanged, `peakBan` | no peak |
| Early / wait | unchanged | same cue / same |

Repeated miss → **exit** the minute (hall), not Game Over.

## Hard fences

- No TAP bar. Recook glow, not UI.
- Never `playbackRate ≠ 1`. Never live Imagine as `m` rises.
- Do not widen `[on, off]` or `C` to “make it playable” — recook the dog.
- Do not cook walk-A and call it a Lane.
- Do not skip `flushOpen` on `ended`.

## One line

**Hit while the gesture lives; 0.22 s after, it is Late; then Miss; the next `on` cuts the grace.** `ended` flushes. The coyote catches the finger, not the clip.
