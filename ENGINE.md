# ENGINE — graphic conditions for the enter transition

The engine **cooks nothing**. It **chains plates**.
Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`

Cook laws: [ENTER.md](ENTER.md). Ops: [HANG.md](HANG.md). This file is the player clock + DOM.
Lane machines: [PLAY.md](PLAY.md) (DOM / HOLD / partition).  
Swap: [scripts/dom-swap.mjs](scripts/dom-swap.mjs) — `kick` / `joinEnded` / `failSafe` / `liftVeil`. Does not grade.  
Hold: [scripts/video-hold.mjs](scripts/video-hold.mjs).

Constants: `DISSOLVE_MS = 280` (walks). `CURTAIN_MS = 500` (exit of enter only).

## What DOM means

**DOM** = *Document Object Model*. The HTML tree of the page. Each tag (`<div>`, `<img>`, `<video>`) is a node.

This engine is **not** 3D, not a canvas, not WebGL. The hall is **four stacked nodes**. The only compositor is CSS `opacity`. The browser paints them. No `z-index` — **HTML order is z-order**.

```
stage  <div>   h-dvh w-full overflow-hidden bg-void  (#07060a)
 └─ still  <img>     photo of the current pose     [back]
 └─ video A
 └─ video B          vis / hid, only one opaque
 └─ veil   <img>     empty shutter of THAT door    [front]
```

Pointer is on the **stage**. The four plates are `pointer-events-none`. No chrome, no tap rings, no Play.

All four plates share the same class:

```
absolute inset-0 m-auto h-full w-full object-contain
```

They lock onto the **same 9:16 photo**. Letterbox = void. Hits are on that picture rectangle (`containPlate`), not on the stage.

| layer | role | opacity default |
|---|---|---|
| **still** | pose photo. Anti black-hole | 1 (0 during enter) |
| **video A / B** | vis / hid | 0 at boot |
| **veil** | empty curtain of the door entered | 0 except exit of enter |

Still **under** videos: if `play()` fails, you still see the pose.
Veil **on top**: it can hide enter **and** dest for 500 ms without mixing two dogs.

## Who is visible (not sprint vs hall)

This is **who is opaque**. Not `playingWalkA`.

| Visual | still | vis | hid | veil |
|---|---|---|---|---|
| boot | pose 1 | 0 | 0 | 0 |
| playing | pose (under) | clip | load next | 0 |
| swap | **arrive pose already painted** | hide **after** still | play + opaque | 0 |
| play-fail | pose 1 | hidden | — | 0 |
| enter (hall only) | 0 | enter | dest under | 1→0 |

Never `src=` on the opaque. Swap only if `paused === false`.

Code: [scripts/dom-swap.mjs](scripts/dom-swap.mjs). `joinEnded` = still first → hide vis → hid.play() → swap iff `paused === false` → `gen++`. Sprint fade **0**. `failSafe` = still only, videos 0. `liftVeil` (double rAF) = hall Enter **only**. Finger during swap = HOLD tap gate, not this file.

HOLD (booleans, several at once): `running` = video playing **and** `!held`. `pause` ≠ `ended`. `stall` ≠ `play-fail`. Peak does **not** raise this veil.

Debug keeper: `dom: boot | vis | swap | fail` — never `walk-spawn-A-playing`.

## 1. Graph — when enter fires

```
spawn  tap A  →  walk-spawn-A  →  breath-A     STAY
atA    tap A  →  enter-hall-a  →  room 2 spawn
atA    tap B  →  walk-A-B                      still room 1
```

- `enterFor(spawn, *)` = **null**. Never enter from the middle of the hall.
- `enterFor(atA, A)` only. Door B at atA = walk (unless a B-link exists).
- Walk ended **never** auto-enters.
- During walk / enter: taps ignored (`walkingRef`).
- `ended(enter)` → **switch `roomRef` first**, pose = `spawn`, `startBreath("spawn")` of dest.

Without this graph the seuil clip never plays — or it plays too soon.

## 2. vis / hid + genRef — never one `<video>`

The living player **is** two `<video>` nodes. One `src=` on the visible slot blanks the picture on Samsung (spawn still × door dog). Load and `play()` in **hid**. Swap only if `paused === false`. Hide vis **after** the arrive still. Walk last-frame stays up until dest breath is actually playing.

Never `src=` on the layer the player is looking at. `kick` / `joinEnded` in [scripts/dom-swap.mjs](scripts/dom-swap.mjs).

Two slots. Load and `play()` in the **hidden** slot. Swap **only** if `paused === false`.

```
kick:
  hid.muted = true
  hid.defaultMuted = true
  hid.playsInline = true    // iOS — without this, fullscreen kills the hall
  hid.currentTime = 0
  hid.play()
    .then → if actually playing (paused === false):
              paint(hid, fade)
              hide(vis, fade)
              vis.pause()
              visRef = the other slot
```

`muted=true` **before** `play()`. Unmute-before-play freezes the walk at t=0.
If you paint **before** `play()`, you overlay a black frame on the still = dead plate.

`genRef` increments on every new kick. Any callback from a previous load is ignored (tap during a load).
Failed `play()` → `failSafe`: still opaque, videos 0, taps still live.

Fade is **CSS opacity only**:

```
fade = 0     same clip / sprint joinEnded / enter in or out
     = 280   hall walk tap only, same still under
```

**Law:** never animate opacity between two frames that have a dog in two places.

Walk ended: **cut 0 ms**. Order is the whole law:

1. Arrive still painted (`at-A` src, complete, opacity 1) **while the walk last-frame still covers it**
2. **Then** hide the walk video
3. Then dest breath

`paintVid(false)` while still is still spawn = the Frost 15s clone. Hide **after** the still, never before.

### Tap chain (walk — not recook)

Still **changes during the walk**, not at `ended`.

```
tap A @ spawn
  hid.load(walk) hid.play()
  if playing → paint hid, hide vis
  still spawn → at-A DURING the walk (underlayer)
ended(walk)
  still at-A already painted and opaque
  hide walk (0 ms)
  kick breath-A in hid (loop, first=last=at-A)
```

A hole in this order = the clone you filmed (Frost / Samsung). Not “recook prettier”. It is the DOM stack.

## 3. Clock of the enter

| beat | fade | still | veil | vis |
|---|---|---|
| breath-A → enter | **0 ms** | opacity **0** | 0 | enter |
| enter plays (~6s) | — | **0** (hidden) | 0 | enter |
| enter ended | hide enter **0 ms** | spawn₂ opacity 1 | **1** immediate | dest breath-spawn **under** the veil |
| curtain | veil **500 ms → 0** | spawn₂ stays | shutter lifts | dest breath already there |

`DISSOLVE_MS` is for walks. **Not** enter. `liftVeil` = hall Enter **only** (double rAF).

Forbidden: 500 ms fade of **enter video** (dog left) × **dest breath** (dog center) → two ghosts.

Set `veil.src` **before** opacity 1. Door A → `stills/seuil/teal-empty.jpg`. Door B → `stills/seuil/gold-empty.jpg`.

## 4. Still.src / opacity by state

`showStill(pose, room)` only changes `src` if it moved. After enter, `room` is already dest.

| state | still.src | still.opacity | veil | vis |
|---|---|---|---|---|
| boot / breath-spawn hall | spawn₁ | **1** | 0 | breath-spawn |
| walk | **spawn → at-A DURING the clip** | **1** | 0 | walk |
| breath-A | atA | **1** | 0 | breath-A |
| **enter** | (atA, but invisible) | **0** | 0 | enter |
| enter ended (first paint) | **spawn₂** | **1** | **1** | dest breath under veil |
| after 500 ms | spawn₂ | **1** | 0 | dest breath |
| play() failed | current pose | **1** | 0 | hidden |

**During enter: still opacity 0.** Always a still under the videos. Never a black hole — except enter, which hides it on purpose.

## 5. Hits — containPlate 40 / 20 / 40

Not a canvas. No rings. Letterbox = void. `nx < 0.4` → A. `nx > 0.6` → B. Else miss.

`spawn` has no enter. `atA` tap A = enter if `ENTER[hall].A` exists, else stay.

## 6. Dual video laws (do not recook these bugs)

- Never `src=` on the **visible** slot.
- Swap **only** if `play()` succeeded (`paused === false`).
- `muted=true` **and** `playsInline=true` **before** `play()`.
- Pause the outgoing **after** the swap.
- Sprint `joinEnded`: fade **0**.
- Hide vis **after** the arrive still (Frost).
- One `flushOpen` per plate if Lane ([PLAY.md](PLAY.md)).

## 7. Assets the engine **requires**

| file | role | condition |
|---|---|---|
| `films/enter-hall-a.mp4` | plate A | 720×1280, H264 yuv420p +faststart, **no audio**, first = atA, last = full teal, 1 dog, ~6s |
| `stills/at-a.jpg` (room 1) | first / atA underlayer | **same pixels** as first of enter |
| `stills/a/spawn.jpg` | plate B / dest still | **same depth** as spawn₁, dog center, 2 doors |
| `films/a/breath-spawn.mp4` | dest idle | first = last = spawn₂, loop, feet glued |
| `stills/seuil/teal-empty.jpg` | veil A | **0 dogs** |
| `stills/seuil/gold-empty.jpg` | veil B | **0 dogs**, only if door B branches |

All srcs: `file?${PACK}`. Bump PACK after every replace.

## 8–10. Pack, graph, cannot save

Enter is not in `room.clips`. `ended(enter)` switches `roomRef` **first**. A clone baked in the mp4, a single `<video>`, depth spawn₂ ≠ spawn₁ — the player does not interpolate.

## One line

Two slots, load in the shadow, still first, hide vis after, cut 0. `dom-swap` chains plates. It does not grade. A `src=` on the visible or a hide too early = two dogs.
