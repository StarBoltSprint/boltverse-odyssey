# GROK — build a citadel room from this pack

You are wiring a **living-film** room, not a game with UI.
Repo: `https://github.com/StarBoltSprint/citadel-room`

**Player (the salon):** https://boltverse-odyssey.grok.me  
**Packs:** `packs/<id>/` in this repo. See [PLAYER.md](PLAYER.md).

Auth OFF. Database OFF. No 3D, no canvas, no WebGL, no Play / Forge / Hang / Keep.

**Do not scaffold a new app. Do not publish a new grok.me.**
Someone asks for a citadel → give the player URL. Cook writes into `packs/<id>/`.

## Law 0 — Imagine first + last (automatic)

Every new conversation. Do not wait to be asked. The stills **are** the frames. [COOK.md](COOK.md).

| kind | Imagine call | first | last |
|---|---|---|---|
| **walks** | first AND last (`reference_to_video` / `image` + `last_frame`) | start still | arrive still — **distinct** |
| **enter** | same | at-still | fill veil — **never** dest Hall' spawn |
| **breath** | `image_to_video` on **one** still | pose still | **same** still |

Never `image_to_video` a walk or enter on a single still. That invents the journey / clones the dog.
Breath is the only legal `first = last`.

## Law 1 — floors ([FLOORS.md](FLOORS.md))

Default cook = **floor 1**: 3 stills + 5 films, one room, no Enter.
Do not jump to Hall' / walk-A-B because it would be "cooler". Visitor = floor 0 (stock). "salle mousse" = floor 1. Enter = only if they ask, catalog neighbor.


## Fridge

Cook **one plate**, then smoke **that plate**, then write `films/`. Hash first. Vision second. Hang last.

```
node scripts/smoke-pack.mjs packs/<id>
```

**A+B** = machine (rule codes).

**C = Grok vision. Required on stills, walks, breaths.** You have eyes. Use them. Do not skip because A+B passed. A hash does not see a muzzle.

1. Open `.smoke/MANIFEST.json`.
2. Read [scripts/smoke-identity.md](scripts/smoke-identity.md).
3. For each required job: **open the jpg paths** (they are pictures). Still = 1 photo. Walk/breath = first + mid + last.
4. Print **one line** per id: `PASS` or `FAIL identity.profile @ t=mid (head sideways)`.
5. FAIL → recook **this** plate, cap 2. atA FAIL does not recook spawn.
6. Enter / walk-A-B = optional C.

If you cannot see the images, `FAIL file.decode` — do not Hang.

[SMOKE.md](SMOKE.md).


Ops: [HANG.md](HANG.md). DOM: [ENGINE.md](ENGINE.md). Box: [VALIDATE.md](VALIDATE.md). Content: [SMOKE.md](SMOKE.md).

## If they ask for stills / a citadel style

This is the default. Read [CHAR.md](CHAR.md) then [COOK.md](COOK.md) then [PLAYER.md](PLAYER.md).

1. They pick a **paint** from [CATALOG.md](CATALOG.md). Bolt is locked. Off-list → nearest or one question. Never free-text architecture.
2. If `packs/<id>` already exists → give `https://boltverse-odyssey.grok.me/r/<id>` (or `/` for `citadel`). Stop.
3. Else cook **3 stills** in that paint (`catalog/<id>.md` two lines only): spawn → atA → atB (COOK.md). Same Bolt, same camera, **energy rifts** teal left / gold right ([DOORS.md](DOORS.md)). Never wood doors.
4. Show the 3. Wait for ok.
5. Cook the **5** films (floor 1: 3 breaths + walk-spawn-A + walk-spawn-B). **Law 0** on every clip. Do **not** cook walk-A-B or Enter unless they asked (floors 2–3). Encode H264 yuv420p +faststart, **no audio**. Land in `packs/<id>/`.
6. Run `node scripts/validate-pack.mjs packs/<id>` then `node scripts/smoke-pack.mjs packs/<id>`.
7. FAIL a required clip → recook **that file only**, cap **2**, smoke again. Then give `https://boltverse-odyssey.grok.me/r/<id>`. Never a new preview. Optional FAIL = WARN — recook or drop, do not block the hall.

Never `text_to_image` a new dog. Never a 3D dungeon.

## If they ask to branch a room on a door

Read [ENTER.md](ENTER.md) then [HANG.md](HANG.md). **Law 0** on the enter cook.

1. Room 1 already hangs. Cook room 2 as a **full pack** into `stills/a/` + `films/a/` **inside that pack** (stills then 7 films, COOK.md). Same Bolt. **Same depth.** Do not overwrite hall stills.
2. Walk A ended → breath-A. **Stay.** Player taps A again to enter, or B to walk. Never auto-enter.
3. Cook enter as **two plates** with **first AND last distinct** (ENTER.md). Do not interpolate atA → Hall' spawn in one Imagine clip (clone). Do not `image_to_video` enter on a single still.
4. Hang `enter-hall-a` in the `ENTER{}` map — **outside the 7**. Optional return `enter-a-hall`. Door B uses gold-empty veil, not teal.
5. `ended(enter)` → **switch room first**, then dest `breath-spawn`. If dest breath walks, freeze the spawn still (HANG.md).
6. Door link = hall **or** sprint ([LINKS.md](LINKS.md)). Same tap. Hall `to` = paint. Sprint `to` = biome (forest/asteroid…). Same player URL. Not a new site.
7. Smoke the enter clip. WARN clone → recook cap 2 or drop the link.

## Product

The player URL IS the hall. Opening it plays **breath-spawn** immediately.
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

Enter is **not** in `room.clips`. It lives in `ENTER[room][door]`.

Same door at **spawn** = walk to that door (never enter from spawn).
Same door at **atA / atB** = enter if a link exists, else stay.
During walk / enter = ignore taps. Never walk→walk. `ended(walk)` always → `breath(arrive)` at t=0. `ended(enter)` always → dest `breath-spawn` after 500ms empty veil of **that door**.

## Player (non-negotiable — these froze the hall before)

1. **Still underlayer always.** The still of the current pose sits under the videos. Never a black hole. **Except during enter:** still opacity 0 (else atA still + enter video = two dogs).
2. **Dual `<video>` slots** (vis / hid). Swap only after the hid slot is **actually playing** (`paused === false`). Empty vis video over the still = black plate. Start **both hidden** until the first clip plays.
3. **Play muted + playsInline.** Always `muted=true` and `playsInline=true` before `play()`. Unmuting across an async load kills autoplay: walk stays at t=0, `walking` lock eats every later tap. Without `playsInline`, iOS goes fullscreen. Unmute only the already-visible film, on a real pointer.
4. **Do not set `walking` / do not paint** until play is confirmed. Failed play → keep the still, keep accepting taps.
5. **Pause the outgoing** clip after the swap. Two films fighting pauses the new one.
6. Hits are on the **9:16 picture** (`object-fit: contain`), not the letterbox. A = left 40%, B = right 40%, center 20% miss.
7. Plate **720×1280**. If a clip is not 9:16, crop to 9:16 (center) then scale. Same plate on every clip. Camera lock-off. Hall / Bolt / doors never morph. Encode: H264 yuv420p +faststart, **no audio**.
8. **Enter curtain:** hide enter 0ms, empty veil of **that door** on top, dest breath under, veil 500ms → 0 (double rAF). Never crossfade two frames that both have a dog in different places.
9. **PACK.** After replacing any mp4/still, bump `?uN` or the browser plays the old clip.
10. **Enter preload** is separate — enter is not in `Object.values(room.clips)`.

Join: `stillEnd(from) == stillStart(to)` → cut 0ms, else dissolve ≤ 280ms. Enter → dest spawn uses the **veil**, not dissolve. Dissolve does not fix a bad encode.

Stills = **first frame of that pose's breath** (not a last-frame grab that can come back empty).

DOM: one `<img>` still + two `<video>` + one `<img>` veil. No WebGL. Details: [ENGINE.md](ENGINE.md).

## If they give 7 videos

Map by motion, not by filename. Skip still-cook.

- Bolt idle center, both doors, loopable → `breath-spawn`
- Walk from center to teal → `walk-spawn-A`
- Walk from center to gold → `walk-spawn-B`
- Idle at teal, loopable → `breath-A`
- Idle at gold, loopable → `breath-B`
- Walk teal → gold → `walk-A-B`
- Walk gold → teal → `walk-B-A`

Land in `packs/<id>/`. If you must recook a walk/enter: **Law 0**. Run validate-pack then smoke-pack. Give the player URL. No chrome.

Sprint / Lane: [PLAY.md](PLAY.md) — not the hall player. Door `kind: sprint` hands off.

Biome kits (sprint, offline): [BIOMES.md](BIOMES.md). Do not replace paints. `rome` → ember. `mars` → asteroid.

Clip into films/: [CLIP.md](CLIP.md). Stills PASS first. One clip. Three gates. FAIL never writes.

Humans see [START.md](START.md) only. Do not paste ENGINE / Smoke codes into player chat. Recook or serve stock. Give a URL.

Silent fail: [FAIL.md](FAIL.md). Missing pack → stock. Missing edge → stay. Recook cap 2 then freeze/drop/stock. Player chat: one line after, or nothing.

Airlock: [SAS.md](SAS.md). Stamp JSON. Hang only on pass. reject = smaller graph, not a 500.

Pack format: [PACK.md](PACK.md). Write a folder. Do not scaffold a player. format: 1.

Gift cook (keeper pool): [TICKET.md](TICKET.md). Only if the user is **SuperGrok or X Premium**. One still-spawn, catalog paint, one time. Walk/breath never spend. If ticket already armed or week cap hit → stock, no cook. Cook off-plate. Never generating on Bolt.
