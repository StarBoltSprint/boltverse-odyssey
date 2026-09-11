# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall: menu-picture, lock-off, zero chrome. This repo’s player is **(2)** ([ENGINE.md](ENGINE.md)).

A door with `kind: sprint` ([LINKS.md](LINKS.md)) **hands off** to this disc. Cook: [COOKLANE.md](COOKLANE.md).

**The Lane is not a tiny citadel.** Center of the minute = plates + bone. Hall poses (spawn / atA / breath-A) live **only at the edges** (enter / exit / Recall → decay).

## Core

- **Imagine-video-first** — the picture is the clock. Tap / dodge what Bolt *does* in the encode.
- **Momentum chaining** — `m` wakes the world *in* the image (not XP). Sparse → dense.
- **Resonance** = how much (`m`). **Glow** = when. Crystal bar, bottom ~3–4%. **Never** when-to-tap.
- Luminous path in front of the paws (grows with `m`). Corridor of gestures.

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**

## Four nested clocks (one tap at a time)

| # | Layer | = | Where |
|---|---|---|---|
| 1 | **Plate** 6–15s | clip + cues on `currentTime` | **Lane center** |
| 2 | **Room poses** | breath ↔ walk A/B | **Hall**, and Lane **edges** only |
| 3 | **Bone ~60s** | calm → lean → peak via `m` (peak ≠ a 5th door) | **Lane center** |
| 4 | **Citadel enter** | rare / paid → always breath-spawn Hall′ | edge |

Mixing layers → loader / cutscene. One layer per tap. Inside the minute you chain **plates**, not atA.

## Picture-time

Master clock = `video.currentTime` **while the video is playing**.

Not `Date.now`. Not the cook wall clock. Not rAF alone — rAF **paints**; it does not **count** the beat.

Phase = `f(pictureTime)`: cues `on/off`, coyote, glow. Not a second “gameplay” timer.

A cue at 4.2 s is at **4.2 s of the mp4**, not “4.2 s after the tap”.

**Hold** (clock frozen, picture may stay): Pause, tab hidden, `waitingOnCook` (never on the 9:16), `play()` fail.

## Cue sheet + grade

`Plate = clip + duration + cues[] + stillStart/End`  
Cue `on/off` = media seconds. Glow **in the encode** = the chart.

Cook the **gesture first**, then write `cues[]`. Bolt turns right → tap right. Straight run → **no** L/R cue. A random chart on a straight clip = FAIL.

A tap with no Bolt motion in that window = **dead** — do not count, do not overlay an action.

Exactly **one** verdict per cue: Early | Hit | Late | Miss | Idle

- wrong side = Miss
- coyote ~**180–280ms** after `off`
- ≤80ms pre-`on` = Hit
- Hit ↑ `m` ; Late = no peak / no enter-arm ; Miss λ`m` (never 0) + peak ban ; Early ignore (no farm)
- Idle = no-gesture buffer / decay only

`m` picks the **next** plate from a cooked palette (calm / lean / peak / decay). Imagine is not on the tap.

## UI / gestures

Default: **zero words**. **No fill-bars. No Guitar Hero. No NOW.**  
Playtest too hot → **recook the glow**. [DONT.md](DONT.md) §7.

## PCG film-strip (anti-3D)

**role-WFC** 1D ~60s: calm · lean-L/R · fork · peak · decay.  
Not 60 s as **one** clip (no `m` steps).

Prefetch = **stock only**. Never SuperGrok on maybe-enter or as `m` rises.

## Ship gate

Smoke PASS/FAIL before Hang. Sprint plates: **cue honesty** (glow readable; gesture matches the tap). FAIL → decay. `railsVersion` on PASS.

## Hard fences

- If the bar tells you **when** to tap, Smoke failed the plate.
- A cue with no matching gesture = FAIL. Dead tap.
- Peak is earned. Peak is not a door.
- Metronome = Bolt. `m` = how much. Glow = when.
- Do not cook walk-A and call it a Lane ([COOKLANE.md](COOKLANE.md)).
- Hall poses do **not** run the middle of the minute.

## One line

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.** Calm first. Success = faster, brighter. Miss = it falls asleep. Never a button without the dog.
