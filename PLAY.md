# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall: menu-picture, lock-off, zero chrome. This repo’s player is **(2)** ([ENGINE.md](ENGINE.md)).

A door with `kind: sprint` ([LINKS.md](LINKS.md)) **hands off** to this disc. Cook: [COOKLANE.md](COOKLANE.md).  
Clock: [scripts/cue-coyote.mjs](scripts/cue-coyote.mjs) — `makeSheet` / `resolveFrame` / `flushOpen`.  
Hold: [scripts/video-hold.mjs](scripts/video-hold.mjs) — judge sleeps if the picture is not running.  
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
Hit     = [on − 0.08 , off]
Late    = (off , off + C]
Miss    = tap after off+C  OR  no tap when t > off+C
Early   = tap < on − 0.08   (ignore, SAME cue)
wait    = still in Hit or coyote, no tap
```

`C = clamp(0.18, 0.28, 0.22)` then `min(C, next.on − off)`. Late, not a second Hit.  
`ended` → `flushOpen`. One verdict once.

## HOLD (judge sleeps)

If the picture is not running, **do not** call `resolveFrame`. Still stays. No spinner.

Reasons — any one → `isHeld`: `pause` · `hidden` (tab) · `stall` · `play-fail` · `swap` · `cook` (must not happen on tap) · `seek` · `ended-wait` (between plates).

```
attachHold(vis, { onHold, onTime })
timeupdate → onTime only if !held
tap while held → gate queues ONE finger
resume → flush against *this* currentTime
         (not “he tapped 2 s of wall clock ago”)
```

`play()` fail → `play-fail`, still opaque, taps live again. Swap: HOLD until `hid.paused === false`. Hide vis **after** the still. `ended` → `ended-wait` until `pickNext` + kick. Hid not ready → decay, not Imagine.

Bus 1 (weather) freezes with HOLD. Bus 2 (Hit/Late) only if `!held` at the verdict.

## Reel (not the cassette knob)

```
timeupdate
  if (held) return
  sheet.t = currentTime; sheet.tap = gate.flush()
  sheet = resolveFrame(sheet)
ended
  flushOpen → ended-wait → pickNext → beginSwap
  hid.play() → endSwapIfPlaying(hid)  (playbackRate = 1)
```

| Verdict | `m` |
|---|---|
| Hit | `+= 0.1` |
| Miss | `× 0.7`, floor `0.05`, `peakBan` |
| Late | unchanged, `peakBan` |
| Early / wait | unchanged |

Repeated miss → **exit** the minute (hall), not Game Over.

## Hard fences

- No TAP bar. Recook glow, not UI.
- Never `playbackRate ≠ 1`. Never live Imagine as `m` rises.
- Do not call `resolveFrame` while held.
- Do not skip `flushOpen` on `ended`.
- Do not cook walk-A and call it a Lane.

## One line

**If the picture is not running, the judge sleeps.** Resume rereads `currentTime`. It does not catch the coyote with a wall clock.
