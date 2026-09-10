# ENGINE — graphic conditions for the enter transition

The engine **cooks nothing**. It **chains plates**.
Repo: `https://github.com/StarBoltSprint/citadel-room`

Cook laws: [ENTER.md](ENTER.md). Ops: [HANG.md](HANG.md). This file is the player clock + DOM.

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
Failed `play()` → `walkingRef = false`, keep the still, taps still live.

Fade is **CSS opacity only**:

```
fade = 0     same clip
     = 0     entering an enter
     = 0     leaving an enter     ← curtain ≠ dissolve
     = 280   otherwise (walks)
```

`el.style.transition = ms ? opacity ${ms}ms linear : none`

**Law:** never animate opacity between two frames that have a dog in two places.

## 3. Clock of the enter

| beat | fade | still | veil | vis |
|---|---|---|---|---|
| breath-A → enter | **0 ms** | opacity **0** | 0 | enter |
| enter plays (~6s) | — | **0** (hidden) | 0 | enter |
| enter ended | hide enter **0 ms** | spawn₂ opacity 1 | **1** immediate | dest breath-spawn **under** the veil |
| curtain | veil **500 ms → 0** | spawn₂ stays | shutter lifts | dest breath already there |

`DISSOLVE_MS` is for walks. **Not** enter.
`CURTAIN_MS` is **exit** of enter only.

Forbidden: 500 ms fade of **enter video** (dog left) × **dest breath** (dog center) → two ghosts.

At `ended`, what you see = **empty veil of that door**. Under it: spawn₂ already. The enter dog is gone **before** the fade. No clone.

### Double rAF before the curtain

```
veil.src = empty still of THAT door   // teal-empty or gold-empty
veil.style.transition = none
veil.style.opacity = 1
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    veil.style.transition = opacity 500ms linear
    veil.style.opacity = 0
  })
})
```

One `rAF` is not enough: the browser can skip the `opacity = 1` paint and start the transition from 0 → 0. **No curtain.**
Double `rAF` = paint veil at 1 **then** start 1 → 0.

Hide enter at **0 ms** (before the rAF). Paint dest at **0 ms** under the veil. Dest is already Hall′. Veil lifts onto a posed dog.

Set `veil.src` **before** opacity 1. Door A → `stills/seuil/teal-empty.jpg`. Door B → `stills/seuil/gold-empty.jpg`. Hardcoding teal on a gold enter = FAIL.

## 4. Still.src / opacity by state

`showStill(pose, room)` only changes `src` if it moved. After enter, `room` is already dest.

| state | still.src | still.opacity | veil | vis |
|---|---|---|---|---|
| boot / breath-spawn hall | spawn₁ | **1** | 0 | breath-spawn |
| walk | start then arrive still | **1** | 0 | walk (dissolve 280 over it) |
| breath-A | atA | **1** | 0 | breath-A |
| **enter** | (atA, but invisible) | **0** | 0 | enter |
| enter ended (first paint) | **spawn₂** | **1** | **1** | dest breath under veil |
| after 500 ms | spawn₂ | **1** | 0 | dest breath |
| play() failed | current pose | **1** | 0 | hidden |

**During enter: still opacity 0.** Else still atA (dog left) + enter video = engine clone, even if the cook is clean.
On ended: still = `spawn` of **room 2** *before* the veil drops. Hall′ is already behind the curtain.
Dest breath = loop of that **same** still (posed, not a walk). If i2v walks, freeze the still ([HANG.md](HANG.md)).
Always a still under the videos. Never a black hole — except enter, which hides it on purpose.

## 5. Hits — containPlate 40 / 20 / 40

Not a canvas. No rings.

```
pointerdown on stage
  if walkingRef → return
  plate = containPlate(stage width, height)   // 9:16 box inside the dvh
  plate.x += stage.left; plate.y += stage.top
  nx = (clientX - plate.x) / plate.w
  ny = (clientY - plate.y) / plate.h
  outside 0..1 → miss          // letterbox = void, not a door
  nx < 0.4 → A                 // teal, left 40%
  nx > 0.6 → B                 // gold, right 40%
  else     → miss              // center 20%
  edgeFor(pose, hit)           → walk
  else enterFor(room, pose, hit) → enter
```

`containPlate` = letterbox 9:16 (`object-contain` math). Hits on the **picture**, never the black bars.

`spawn` has no enter. `atA` tap A = enter if `ENTER[hall].A` exists, else stay.

## 6. Dual video laws (do not recook these bugs)

- Swap **only** if `play()` succeeded (`paused === false`).
- `muted=true` **and** `playsInline=true` **before** `play()`.
- Pause the outgoing **after** the swap.
- Enter: `loop=false`. Dest breath: `loop=true`, `currentTime=0`.
- Paint dest at **0 ms** (under the veil). No 280 dissolve on this join.
- Both videos **hidden** until the first clip actually plays.
- Preload every clip + still + **enter** in `useEffect` (off-DOM `<video>` / `Image`). Enter is not in `Object.values(room.clips)` — preload it from `ENTER{}`.

## 7. Assets the engine **requires**

| file | role | condition |
|---|---|---|
| `films/enter-hall-a.mp4` | plate A | 720×1280, H264 yuv420p +faststart, **no audio**, first = atA, last = full teal, 1 dog, ~6s |
| `stills/at-a.jpg` (room 1) | first / atA underlayer | **same pixels** as first of enter |
| `stills/a/spawn.jpg` | plate B / dest still | **same depth** as spawn₁, dog center, 2 doors |
| `films/a/breath-spawn.mp4` | dest idle | first = last = spawn₂, loop, feet glued (freeze if it walks) |
| `stills/seuil/teal-empty.jpg` | veil A | **0 dogs**, same oval as last(enter A) |
| `stills/seuil/gold-empty.jpg` | veil B | **0 dogs**, only if door B branches |

If first(enter) ≠ still atA → pop on tap.
If last(enter) reveals Hall′ → Imagine already cloned; the engine cannot repair it.
If the veil has a dog → ghost for 500 ms.
If dest breath **walks** → he re-crosses Hall′ after the curtain.
All srcs: `file?${PACK}`. Bump PACK after every replace.

## 8. One plate

Every mp4 / jpg: **720×1280**, `object-contain`.
A 784×1168 clip = lock-off dead (the frame jumps). Center-crop 9:16 then scale.
Encode: [HANG.md](HANG.md).

## 9. PACK + ENTER map

```
ENTER[hall].A = { to: "a", clip: enter-hall-a }   // not in room.clips
onEnterEnded:
  roomRef = played.to     // FIRST
  poseRef = "spawn"
  startBreath("spawn")    // pack() now = dest
```

If breath runs before the switch, hall spawn plays under the veil.
After hanging a new mp4/still, bump `PACK` (`u26` → `u27`) or the browser keeps the old clip.

## 10. What the engine **cannot** save

- Clone baked in the enter (first left + last center)
- Depth spawn₂ ≠ spawn₁ (fake travelling)
- Black silhouette, face, 3/4 in the cook
- Hall′ leak inside the 6s Imagine
- Gold enter with a teal veil

That is the plate. The player does not interpolate.

## What the DOM **does** guarantee

- never a black hole ([FAIL.md](FAIL.md): no file = no kick, graph shrinks)
- never a black hole (still always there, except enter off on purpose) — [HOLD.md](HOLD.md): `stillEnd` same frame at `ended`, dissolve ≤ 280ms, preload breath before walk ends
- never two videos fighting (pause outgoing)
- never enter from spawn
- curtain without overlaying two dogs (hide enter 0 + empty veil + dest under)

## One line

Cut 0 into enter, still off, 1 dog until teal. Hide enter 0. Empty veil of **that door** 500 ms (double rAF) over a spawn₂ **already posed**. Switch room, then dest breath. Never two dogs on screen at the same time.
