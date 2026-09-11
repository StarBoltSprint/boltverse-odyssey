# PLAY — gamified Imagine (sprint disc)

This is engine grammar **(1)**: you *play* Bolt **inside** an Imagine film.

Distinct from **(2)** — citadel hall: menu-picture, lock-off, zero chrome. This repo’s player is **(2)** ([ENGINE.md](ENGINE.md)).

A door with `kind: sprint` ([LINKS.md](LINKS.md)) **hands off** to this disc. Cook: [COOKLANE.md](COOKLANE.md).  
Clock: [scripts/cue-coyote.mjs](scripts/cue-coyote.mjs) · Hold: [scripts/video-hold.mjs](scripts/video-hold.mjs) · Reel: [scripts/sprint-transition.mjs](scripts/sprint-transition.mjs) · DOM: [scripts/dom-swap.mjs](scripts/dom-swap.mjs).

**The Lane is not a tiny citadel.** Hall poses live **only at the edges**.

## Three machines (not `phase = "playingWalkA"`)

They talk with **flags**. One fat `state.mode` re-glues hall, sprint, and Samsung.

| Machine | File | Says |
|---|---|---|
| **DOM** | [dom-swap.mjs](scripts/dom-swap.mjs) | what is **visible** |
| **HOLD** | [video-hold.mjs](scripts/video-hold.mjs) | whether we **judge** |
| **Partition** | coyote + reel | **which reel** (`sheet`, `m`, palette) |

`running` = video playing **and** `!held`. Only `running` may `resolveFrame` / bump `m`.  
`tier` is not a DOM state. Peak does **not** raise the veil.

`ended` of the video ≠ plate logically done if a cue is still in coyote → `flushOpen` then `afterPlate`.  
`pickNext` only in `ended-wait`. Finger during swap = HOLD tap gate, **not** `dom-swap`.

### Do not confuse

- `pause` ≠ `ended` — else `pickNext` too soon
- `stall` ≠ `play-fail` — buffer may return; do not decay
- `cook` on a tap = a file bug, not a phase

### Races

| Name | Fail |
|---|---|
| **Samsung clone** | `src=` on vis, skip hid + still first |
| **Frost two dogs** | `ended` hide vis **before** arrive still |
| **Coyote wall** | grade while `hidden` with `Date.now` |
| **Double ended** | `ended` + `timeupdate` at duration → `flushOpen` ×2 = two Miss. **One flush per plate** |
| **Swap + tap** | tap on the *old* plate during swap. HOLD + queue |
| **peek peak** | `tier` peak while hid still loads calm. `pickNext` only in `ended-wait` |

Debug keeper: `dom: boot\|vis\|swap\|fail` · `clock: run\|hold` · `part: cues\|flush\|pick\|idle-decay`. Never log `walk-spawn-A-playing`.

## Core

**`m` wakes the world. The tap exists only if it matches a real Bolt gesture already in the shot.**  
**Speed is the next film, not the knob.** `playbackRate = 1` always.

## Year-0 verbs (back, 9:16)

Pose, left, right, fork. Same **40 / 20 / 40** as the hall. Tap token: `A` \| `B` \| `pose`. Peak = earned **state**. 1–3 cues / plate.

## Cue window + coyote

```
Hit     = [on − 0.08 , off]
Late    = (off , off + C]
Miss    = tap after off+C  OR  no tap when t > off+C
Early   = tap < on − 0.08   (SAME cue)
wait    = still in Hit or coyote, no tap
```

`C = clamp(0.18, 0.28, 0.22)` then `min(C, next.on − off)`. One `flushOpen` per plate.

## HOLD

Any one → `isHeld`: pause · hidden · stall · play-fail · swap · cook · seek · ended-wait.  
Tap while held → **one** finger. Resume = *this* `currentTime`.

## Reel

Hit `m += 0.1` · Miss `× 0.7` floor 0.05 + peakBan · Late `m` unchanged + peakBan.  
Sprint `joinEnded` fade **0**. Repeated miss → hall. Hid not ready → `failSafe` / decay, not Imagine.

## Hard fences

- No TAP bar. Never `playbackRate ≠ 1`. Never live Imagine as `m` rises.
- Do not call `resolveFrame` while held. Do not `pickNext` outside `ended-wait`.
- One `flushOpen` per plate. `joinEnded` still first. Do not cook walk-A as a Lane.

## One line

**DOM says what we see. HOLD says if we judge. Partition says which reel.** `dom-swap` chains. It does not grade.
