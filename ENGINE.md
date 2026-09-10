# ENGINE — graphic conditions for the enter transition

The engine **cooks nothing**. It **chains plates**.
Repo: `https://github.com/StarBoltSprint/citadel-room`

Cook laws: [ENTER.md](ENTER.md). This file is the player clock.

Constants: `DISSOLVE_MS = 280` (walks). `CURTAIN_MS = 500` (exit of enter only).

## 1. Graph — when enter fires

```
spawn  tap A  →  walk-spawn-A  →  breath-A     STAY
atA    tap A  →  enter-hall-a  →  room 2 spawn
atA    tap B  →  walk-A-B                      still room 1
```

- `enterFor(spawn, *)` = **null**. Never enter from the middle of the hall.
- `enterFor(atA, A)` only. Door B at atA = walk.
- Walk ended **never** auto-enters.
- During walk / enter: taps ignored (`walkingRef`).
- `ended(enter)` → `room = dest`, pose = `spawn`, `startBreath("spawn")`.

Without this graph the seuil clip never plays — or it plays too soon.

## 2. DOM — 4 layers, fixed order

```
[back]  still <img>     spawn / atA / atB of the current room
        video A
        video B         vis/hid, only one opaque
[front] veil <img>      empty cyan, opacity 0 except during curtain
```

All: `absolute inset-0`, `object-contain`, plate **720×1280** 9:16.
Hits on the **picture**, not the letterbox (A = left 40%, B = right 40%, center miss).

## 3. Clock of the enter

| beat | fade | still | veil | vis |
|---|---|---|---|---|
| breath-A → enter | **0 ms** | opacity **0** | 0 | enter |
| enter plays (~6s) | — | **0** (hidden) | 0 | enter |
| enter ended | hide enter **0 ms** | spawn₂ opacity 1 | **1** immediate | dest breath-spawn **under** the veil |
| curtain | veil **500 ms → 0** | spawn₂ stays | cyan lifts | dest breath already there |

`DISSOLVE_MS` is for walks. **Not** enter.
`CURTAIN_MS` is **exit** of enter only.

Forbidden: 500 ms fade of **enter video** (dog left) × **dest breath** (dog center) → two ghosts.

## 4. Still — picture-clock

- Always a still under the videos. Never a black hole.
- **During enter: still opacity 0.** Else still atA (dog left) + enter video = engine clone, even if the cook is clean.
- On ended: still = `spawn` of **room 2** *before* the veil drops. Hall′ is already behind the curtain.
- Dest breath = loop of that **same** still (posed, not a walk).

## 5. Dual video (vis / hid)

- Swap **only** if `play()` succeeded (`paused === false`).
- `muted=true` **before** `play()`.
- Pause the outgoing **after** the swap.
- Enter: `loop=false`. Dest breath: `loop=true`, `currentTime=0`.
- Paint dest at **0 ms** (under the veil). No 280 dissolve on this join.

## 6. Assets the engine **requires**

| file | role | condition |
|---|---|---|
| `films/enter-hall-a.mp4` | plate A | 720×1280, H264, **no audio**, first = atA, last = full teal, 1 dog, ~6s |
| `stills/at-a.jpg` (room 1) | first / atA underlayer | **same pixels** as first of enter |
| `stills/a/spawn.jpg` | plate B / dest still | **same depth** as spawn₁, dog center, 2 doors |
| `films/a/breath-spawn.mp4` | dest idle | first = last = spawn₂, loop, feet glued |
| `stills/seuil/teal-empty.jpg` | veil | **0 dogs**, same oval as last(enter) |

If first(enter) ≠ still atA → pop on tap.
If last(enter) reveals Hall′ → Imagine already cloned; the engine cannot repair it.
If the veil has a dog → ghost for 500 ms.
If dest breath **walks** → he re-crosses Hall′ after the curtain.

## 7. One plate

Every mp4 / jpg: **720×1280**, `object-contain`.
A 784×1168 clip = lock-off dead (the frame jumps). Center-crop 9:16 then scale.

## 8. What the engine **cannot** save

- Clone baked in the enter (first left + last center)
- Depth spawn₂ ≠ spawn₁ (fake travelling)
- Black silhouette, face, 3/4 in the cook
- Hall′ leak inside the 6s Imagine

That is the plate. The player does not interpolate.

## One line

Cut 0 into enter, still off, 1 dog until teal. Hide enter 0. Empty cyan veil 500 ms over a spawn₂ **already posed**. Never two dogs on screen at the same time.
