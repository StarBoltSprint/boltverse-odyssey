# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall: menu-picture, lock-off, zero chrome. This repo’s player is **(2)** ([ENGINE.md](ENGINE.md)).

Valley / sprint / QTE = **(1)** + hall poses as a state machine. A door with `kind: sprint` ([LINKS.md](LINKS.md)) **hands off** to this disc.

## Core

- **Imagine-video-first** — the picture is the clock. Tap / dodge what Bolt *does* in the encode.
- **Momentum chaining** — the sprint wakes the world *in* the image (not XP). Sparse → dense.
- **Resonance** = how much (`m`). **Glow** = when. Crystal bar, bottom ~3–4%. **Never** when-to-tap.
- Luminous path in front of the paws (grows with `m`). Corridor of gestures.

## Four nested clocks (one tap at a time)

| # | Layer | = |
|---|---|---|
| 1 | **Plate** 6–15s | clip + cues on `currentTime` |
| 2 | **Room poses** | breath-loop ↔ walk A/B · Howl = re-breath · Recall = spawn · Pause freeze |
| 3 | **Bone ~60s** | quiet → lean → peak via `m` / WFC / CA (peak ≠ a 5th door) |
| 4 | **Citadel enter** | rare / paid → always breath-spawn Hall′ |

Mixing layers → loader / cutscene. One layer per tap. Felt: breath / sprint / threshold / bone.

## Picture-time

Master clock = `video.currentTime` **while the video is playing**.

Not `Date.now`. Not the cook wall clock. Not rAF alone — rAF **paints**; it does not **count** the beat.

Phase = `f(pictureTime)`: cues `on/off`, coyote, glow. Hall already uses this (breath/walk). Lane adds cues **on the same clock**. Not a second “gameplay” timer.

A cue at 4.2 s is at **4.2 s of the mp4**, not “4.2 s after the tap”.  
Seek / reload / dual-video swap: the beat follows the **frame**, not a JS timer that drifted.

**Hold** (clock frozen, picture may stay):

- player Pause
- tab hidden
- `waitingOnCook` (never on the 9:16 — stock already there)
- `play()` fail

Diegetic audio freezes with it. Grade oneshots only if the clock is advancing.

Prefetch is fine. Generating while `currentTime` advances = two clocks = [DONT.md](DONT.md).

## Cue sheet + grade

`Plate = clip + duration + cues[] + stillStart/End`  
Cue `on/off` = media seconds. Glow **in the encode** = the chart. Hitboxes only `on` … `off` + coyote.

Cook the **gesture first**, then write `cues[]`. Bolt turns right → tap right. Straight run → **no** L/R cue. A random chart on a straight clip = FAIL.

Exactly **one** verdict per cue: Early | Hit | Late | Miss | Idle

- wrong side = Miss
- coyote ~**180–280ms** after `off` (cuts at next `on`)
- ≤80ms pre-`on` = Hit
- Hit ↑ `m` ; Late = no peak / no enter-arm ; Miss λ`m` (never 0) + peak ban ; Early ignore (no farm)
- Idle = breath / none only ; plate-end, no tap on a walk = Miss
- **enter** = 2nd cue, armed **after** a walk Hit on that door

Resolve: coyote-of-prev **before** Early-on-next.

What helps **without** saying “now”: glow big in the encode on `[on, off]`; coyote so you are not a robot; Early ignored; Miss never zeros `m`; breath has no cue. Decay / stock if the plate is unreadable — do not “fix” it with chrome.

## UI / gestures

Default: **zero words**. The picture suggests tap / swipe / hold.  
Lane option: L/R hits with Resonance, never a TAP stamp on Bolt.  
**No fill-bars. No Guitar Hero lane. No NOW.** Jump = glow in the film, one tap center.

Playtest too hot → **recook the glow** (earlier, bigger). Same reflex as Smoke: the defect is the plate, not the UI. [DONT.md](DONT.md) §7.

## Audio (2 buses)

1. Plate diegetic weather (mute if fake TAP / speech / wrong glow)
2. Engine grade one-shots (Hit = soft crystal, Late = duller, Miss = drain, Early = silence)

Pause freezes beds. No second cook for audio-only Imagine.

## PCG film-strip (anti-3D)

No voxels / navmesh / HUD billboard.

**role-WFC** 1D ~60s: calm · lean-L/R · fork · peak · decay · breath · enter.

Tap = observe live. Contradiction → decay/stock, never pause.

Prefetch = **stock only**. Imagine paid only on confirm / ticket. Never SuperGrok on maybe-enter or walk-toward.

## Ship gate

Smoke PASS/FAIL before Keep / Hang (lint: 9:16, lock, white GSD, 2 doors, no chrome, path, cue honesty, continuity). FAIL → decay stock. `railsVersion` on PASS.

Hall Smoke ([SMOKE.md](SMOKE.md)) still runs on citadel plates. Sprint plates add **cue honesty** (glow readable in `[on, off]`; gesture in the frame matches the tap).

## Hard fences

- If the bar tells you **when** to tap, Smoke failed the plate.
- Too hot at playtest → recook the glow. Never a timing bar.
- A cue with no matching gesture in the film = FAIL.
- Peak is earned. Peak is not a door.
- Metronome = Bolt. Resonance = how much. Glow = when.
- Citadel hall (2) does **not** grow this stack. A door hangs it ([LINKS.md](LINKS.md)).
- Lane cues live on `currentTime`. No second JS clock.

## One line

Film = chart. Glow in the picture (when). `m` = Resonance (how much). Recook glow, not UI. Picture-time = truth. Peak earned. The metronome is Bolt.
