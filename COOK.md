# COOK — player asks for 3 stills, Grok cooks Bolt into their citadel

This is the product. The player does **not** pick films first. They ask Grok for **3 stills** in a citadel style. Grok supplies them with the **same Bolt** ([CHAR.md](CHAR.md)). **Do not wait.** Stills → smoke → films. Order: [COOKROOM.md](COOKROOM.md). Wait only if COOK_DEBUG=1.

Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`
Ops / folders / encode / PACK: [HANG.md](HANG.md).

## Clip queue

Stills PASS, then **one** film at a time through [CLIP.md](CLIP.md). Never five Imagines in parallel. Never a FAIL in `films/`.

## Law 0 — Imagine first + last (automatic)

Every new conversation. Do not wait to be asked.

| kind | Imagine call | first | last |
|---|---|---|---|
| **walks** | API `image` + **`last_frame`** (hooks / `videos/generations`) | start still | arrive still — **distinct** |
| **enter** | same | at-still | fill veil — **never** dest spawn |
| **breath** | `image_to_video` on **one** still | pose still | **same** still |

**`last_frame` is an aim, not a paste.** The API sends the arrive still. Imagine *steers*. If spawn is 0.19 and at-A is 0.45, the jump is too far — it keeps the start. Last picture = spawn. `graph.last_not_official`. Not an unplugged cable.

Keep the size step small: spawn **0.22–0.32**, sill **0.35–0.40**, **Δh/H < 0.12**. Then 8s. If last still = spawn after cap 2 → stock, tap stays.

**`reference_to_video` is not first/last.** The images are *references*, not frames. Imagine *inspires* a walk. It does **not** paste the gold still as the last picture. Walk-B then overshoots into the oval → size pop. **Illegal for walks and enter.**

Chat Grok has no `last_frame` tool. Walks go through `scripts/imagine-hooks.mjs` / `cook-room.mjs`, not chat Imagine.

Never `image_to_video` a walk or enter on a single still. That invents the journey / clones the dog. Breath is the only legal `first = last`.

After the clip: extract last.jpg. If last ≠ arrive still (`gate.size` / `graph.last_not_official`) → recook the walk, cap 2. **Do not** replace a small official still with a fat last frame to “fix” the splice. If last PASSES size, you may copy last → still so the player swap is hash 0. If last FAILS size, recook.

## Law 1 — floors ([FLOORS.md](FLOORS.md))

Default = **floor 1**. 3 stills + **5** films. One room. No Enter. No walk-A-B unless they ask.


After **each** plate: `smoke(file, kind, refs)` ([SMOKE.md](SMOKE.md)). PASS writes `films/`. FAIL recooks **this** plate, cap 2.

## What the player may change

**A catalog paint only.** One id from [CATALOG.md](CATALOG.md): moss · ember · dusk · asteroid · frost · ivy · ash · tide · ember-deep · gold.
Off-list → nearest, or ask "did you mean ember?". Never "describe any temple". Paste the two lines from `catalog/<id>.md` into Imagine. Do not dream an architecture.

## What is locked (pack)

| lock | value |
|---|---|
| Bolt | [CHAR.md](CHAR.md) — **full white, ZERO black, no saddle** · [`lock/bolt-back.jpg`](lock/bolt-back.jpg) |
| Camera | lock-off, 9:16, plate 720×1280 |
| Doors | **energy rifts** — A left cyan-teal, B right gold-orange. Jambs+sill+gap, RECT fill, never wood. [DOORS.md](DOORS.md) |
| Spawn | both doors in frame, Bolt center, back to camera |
| atA | Bolt at teal; gold still visible |
| atB | Bolt at gold; teal still visible |

Composition examples (camera + door layout, not the player's hall):

- [`lock/example-spawn.jpg`](lock/example-spawn.jpg)
- [`lock/example-at-a.jpg`](lock/example-at-a.jpg)
- [`lock/example-at-b.jpg`](lock/example-at-b.jpg)

## Player phrases (treat as this flow)

- "citadelle mousse" / "citadel moss" → floor 1, `cookRoom("moss")`
- "braise" / "ember" → `ember`
- off-list ("temple martien") → ask nearest paint, do not cook
- "branche room 2 sur la porte A" → floor 3, `kind: hall` ([LINKS.md](LINKS.md))
- "colle le sprint forest sur la porte B" → `kind: sprint`, biome Lane, Bolt exits ([LINKS.md](LINKS.md))

If they give **no** paint, do not cook — send `/` (stock). If they give **7 videos**, skip still-cook — map and hang ([GROK.md](GROK.md)).

## Stills — order is law

Do **not** roll 3 separate text-to-image. One spawn. Two moves.

Room 1 → `stills/spawn.jpg` `stills/at-a.jpg` `stills/at-b.jpg`.
Room 2 → `stills/a/spawn.jpg` `stills/a/at-a.jpg` `stills/a/at-b.jpg`. **Do not overwrite room 1.**
Without `stills/a/` Grok writes over hall and the citadel dies.

### 1. spawn

`reference_to_image` · images: `lock/bolt-back.jpg` + `lock/example-spawn.jpg` · aspect `9:16`

Prompt slot:

> Same dog as the first image — FULL-white German Shepherd, ZERO black on the coat, no saddle, no mask, no black ears, teal collar, back to camera, standing, large (spawn size band). Same camera and door layout as the second image: cyan-teal energy rift left, gold-orange energy rift right, both full RECT holes with jambs and sills, lock-off. Never wood doors. Hall restyled with ONLY these materials (from catalog/<id>.md): **{two lines}**. Photoreal 9:16. No face, no UI, no 3/4. No extra door.

Save → `stills/spawn.jpg` (or `stills/a/spawn.jpg`). Scale 720×1280.

### 2. atA — from spawn, not from text

`image_to_image` · source = the spawn you just made

> Same hall, same camera, same light, same doors. Only the dog walks to the teal portal on the left and stops, still back to camera. Gold portal stays in frame. Feet on the floor. Coat stays full white — no saddle.

Save → `stills/at-a.jpg` (or `stills/a/at-a.jpg`).

### 3. atB — from the same spawn

`image_to_image` · source = **spawn** (not atA)

> Same hall, same camera, same light, same doors. Only the dog walks to the gold portal on the right and stops, still back to camera. Teal portal stays in frame. Feet on the floor. Coat stays full white — no saddle.

Save → `stills/at-b.jpg` (or `stills/a/at-b.jpg`).

### 4. Show the 3. Wait.

If any FAIL below, recook from spawn. Do not invent a fourth still. Do not cook films yet.

## Stills FAIL (recook)

- Bolt face / 3/4 / profile / different dog
- grey / silver coat, black saddle, black mask, black ears (`identity.coat` / `identity.saddle`)
- Doors swapped or missing (spawn must show **both**)
- Wood leaves / ajar timber / flat teal paint / third door / RECT morphing to a circle ([DOORS.md](DOORS.md))
- Camera moved / zoomed / tilted
- Hall architecture morphs between spawn and atA/atB
- Plate not 9:16
- UI, text, watermark, chrome

## Films — only after the player oks the 3 stills

Stills **are** first and last frames. Do not re-imagine a new hall. **Law 0.**

**Walks and enter: first AND last must be distinct images.** Breath is the only legal `first = last` loop. Enter is **not** `image_to_video` on one still — `last = first` invents a journey / clone. See [HANG.md](HANG.md).

Floor 1 films → `films/` (the 5). Floor 2 = walk-A-B / B-A if asked. Floor 3 = `films/a/` + enter, only if asked. [FLOORS.md](FLOORS.md).

| clip | tool | first | last | dur | law |
|---|---|---|---|---|---|
| breath-spawn | image_to_video on spawn | spawn | spawn | 6s | in-room: loop, feet glued |
| breath-A | image_to_video on atA | atA | atA | 10s | in-room: loop, feet glued |
| breath-B | image_to_video on atB | atB | atB | 10s | in-room: loop, feet glued |
| walk-spawn-A | API last_frame spawn→atA | spawn | atA | **8s** | arrive ~2s then HOLD. No round trip |
| walk-spawn-B | API last_frame spawn→atB | spawn | atB | **8s** | idem |
| walk-A-B | API last_frame atA→atB | atA | atB | **8s** | **floor 2** — only if asked |
| walk-B-A | API last_frame atB→atA | atB | atA | **8s** | **floor 2** — only if asked |

Walk prompt slot (every walk):

> Lock-off. 8 seconds. He walks to the door (~5s) and HOLDS (~3s). Do not walk back to spawn. last_frame locks the last picture, not the path — leftover seconds = round trip = FAIL. FULL-white GSD, teal collar, back the whole clip. No 3/4, no morph.

### Breath — two laws

**In-room** (the 7 of the hall you are already in). Micro head is allowed:

> Lock-off. Same still. The dog breathes, micro head, feet glued to the floor. Hall frozen. Seamless loop. No walk, no turn, no face.

**Dest after enter** (`films/a/breath-spawn.mp4`). Must be **posed**. If `image_to_video` walks / turns / leaves spawn → **do not hang it**. Freeze the still:

```
ffmpeg -loop 1 -i stills/a/spawn.jpg -t 6 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -r 24 -an -movflags +faststart \
  films/a/breath-spawn.mp4
```

Better a freeze than a second walk across Hall' after the curtain. QC dest: feet glued the whole 6s or replace with the loop.

### Encode (every mp4)

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart out.mp4
```

No audio. `yuv420p` + `faststart`. A 784×1168 clip gets center-crop 9:16 then scale — otherwise lock-off dies.
Then bump `PACK` (`?uN`). No bump = browser replays the old mp4.

Hang: [GROK.md](GROK.md) + [ENGINE.md](ENGINE.md). Open = breath-spawn. No chrome.

## Linger then warp (the dash)

He parks mid-hall, then `last_frame` yanks him to at-A. Last picture can be correct. The **path** is illegal.

Cook: leave spawn in **1s**, even gait, arrive ~5s of 8s, hold. Spawn→sill **Δh/H < 0.12**.
Smoke: `graph.walk_linger` (still at spawn ~3s) or `graph.walk_sprint` (warp). Cap 2 → drop the walk, tap = stay. Do not hang the dash.

## Walk FAIL (recook that clip, don't hang it)

- 3/4, profile, fashion-walk, face
- Bolt morph (coat, collar, extra limb)
- grey / saddle / black ears (`identity.coat` / `identity.saddle`)
- Hall morph, door color swap
- First frame ≠ start still / last frame ≠ arrive still (dissolve will not fix this)
- Cooked as `image_to_video` on one still (violates Law 0)
- Cooked as chat `reference_to_video` (not last_frame)
- 10s walk that arrives then returns to spawn (`graph.walk_return`) — recook **8s**, do not hang a trim of the loop

## Enter — second room on a door (after both packs exist)

Do **not** cook enter until:

1. Room 1 stills + 7 films hang and play.
2. Room 2 stills + 7 films exist in `stills/a/` + `films/a/` (this file, other style, **same depth**).
3. Player asks to **branch** door A (or B) onto room 2.

Then read [ENTER.md](ENTER.md) and [HANG.md](HANG.md). Short version:

- **Two plates.** Imagine first+last **distinct** (Law 0): atA → teal-fill (dog **stays left**). Never `image_to_video` on one still. Never `last = Hall' spawn`.
- Engine: 500ms empty veil of **that door** → spawn of room 2. Door A = teal-empty. Door B = **gold-empty**. Do not hardcode teal on a gold enter.
- Dest breath = freeze if i2v walks.
- Enter is **outside the 7** (`ENTER{}` map). `ended` → switch room **then** dest breath-spawn.
- Wire: walk to the door first, **stay**. Second tap = enter. Walk ended **never** auto-enters.
- Bump `PACK` after hanging the new mp4.
