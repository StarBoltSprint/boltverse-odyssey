# GROK — build a citadel room from this pack

You are wiring a **living-film** room, not a game with UI.
Repo: `https://github.com/StarBoltSprint/citadel-room`

Auth OFF. Database OFF. No 3D, no canvas, no WebGL, no Play / Forge / Hang / Keep.

## If they ask for stills / a citadel style

This is the default. Read [CHAR.md](CHAR.md) then [COOK.md](COOK.md).

1. They pick a **citadel style**. Bolt is locked.
2. Cook **3 stills** in that style: spawn → atA → atB (order in COOK.md). Same Bolt, same camera, teal left / gold right.
3. Show the 3. Wait for ok.
4. Cook the 7 films from those stills (COOK.md). Hang the graph (this file).
5. Open = breath-spawn looping. Chrome dégage.

Never `text_to_image` a new dog. Never a 3D dungeon.

## If they ask to branch a room on a door

Read [ENTER.md](ENTER.md).

1. Room 1 already hangs. Cook room 2 as a **full pack** (stills then 7 films, COOK.md). Same Bolt.
2. Walk A ended → breath-A. **Stay.** Player taps A again to enter, or B to walk. Never auto-enter.
3. Cook enter as **two plates** (ENTER.md). Do not interpolate atA → Hall′ spawn in one Imagine clip (clone).
4. Hang `enter-hall-a`. Optional return `enter-a-hall`.
5. Open is still breath-spawn of **room 1**.

## Product

The preview link IS the hall. Opening it plays **breath-spawn** immediately.
No Play button. No Forge. No Hang. No Keep. No menus. No canvas overlay. No tap rings.

## Graph

Poses: `spawn` | `atA` | `atB`
Doors: **A = teal, left** · **B = gold, right**. Both always in frame at spawn.
Acts: **breath** (loop, feet glued) | **walk** (one-shot, pose advances at `ended`) | **enter** (one-shot, room advances at `ended` — [ENTER.md](ENTER.md)).

| id | act | loop | dur | start → end |
|---|---|---|---|---|
| breath-spawn | breath | yes | 6s | spawn → spawn |
| breath-A | breath | yes | 10s | atA → atA |
| breath-B | breath | yes | 10s | atB → atB |
| walk-spawn-A | walk | no | 10s | spawn → atA |
| walk-spawn-B | walk | no | 10s | spawn → atB |
| walk-A-B | walk | no | 10s | atA → atB |
| walk-B-A | walk | no | 10s | atB → atA |
| enter-hall-a | enter | no | 6s | atA(hall) → spawn(room 2) |

Same door at **spawn** = walk to that door (never enter from spawn).
Same door at **atA / atB** = enter if a link exists, else stay.
During walk / enter = ignore taps. Never walk→walk. `ended(walk)` always → `breath(arrive)` at t=0. `ended(enter)` always → dest `breath-spawn` after 500ms empty-teal veil.

## Player (non-negotiable — these froze the hall before)

1. **Still underlayer always.** The still of the current pose sits under the videos. Never a black hole. **Except during enter:** still opacity 0 (else atA still + enter video = two dogs).
2. **Dual `<video>` slots** (vis / hid). Swap only after the hid slot is **actually playing** (`paused === false`). Empty vis video over the still = black plate. Start **both hidden** until the first clip plays.
3. **Play muted.** Always `muted=true` before `play()`. Unmuting across an async load kills autoplay: walk stays at t=0, `walking` lock eats every later tap. Unmute only the already-visible film, on a real pointer.
4. **Do not set `walking` / do not paint** until play is confirmed. Failed play → keep the still, keep accepting taps.
5. **Pause the outgoing** clip after the swap. Two films fighting pauses the new one.
6. Hits are on the **9:16 picture** (`object-fit: contain`), not the letterbox. A = left 40%, B = right 40%, center 20% miss.
7. Plate **720×1280**. If a clip is not 9:16, crop to 9:16 (center) then scale. Same plate on every clip. Camera lock-off. Hall / Bolt / doors never morph.
8. **Enter curtain:** hide enter 0ms, empty-teal veil on top, dest breath under, veil 500ms → 0. Never crossfade two frames that both have a dog in different places.

Join: `stillEnd(from) == stillStart(to)` → cut 0ms, else dissolve ≤ 280ms. Enter → dest spawn uses the **veil**, not dissolve. Dissolve does not fix a bad encode.

Stills = **first frame of that pose's breath** (not a last-frame grab that can come back empty).

DOM: one `<img>` still + two `<video>` + one `<img>` teal veil. No WebGL.

## If they give 7 videos

Map by motion, not by filename. Skip still-cook.

- Bolt idle center, both doors, loopable → `breath-spawn`
- Walk from center to teal → `walk-spawn-A`
- Walk from center to gold → `walk-spawn-B`
- Idle at teal, loopable → `breath-A`
- Idle at gold, loopable → `breath-B`
- Walk teal → gold → `walk-A-B`
- Walk gold → teal → `walk-B-A`

Then wire the graph. Open = breath-spawn. Chrome dégage.
