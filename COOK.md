# COOK — player asks for 3 stills, Grok cooks Bolt into their citadel

This is the product. The player does **not** pick films first. They ask Grok for **3 stills** in a citadel style. Grok supplies them with the **same Bolt** ([CHAR.md](CHAR.md)). Films come after the player oks the stills.

Repo: `https://github.com/StarBoltSprint/citadel-room`
Ops / folders / encode / PACK: [HANG.md](HANG.md).

## Law 0 — Imagine first + last (automatic)

Every new conversation. Do not wait to be asked.

| kind | Imagine call | first | last |
|---|---|---|---|
| **walks** | first AND last (`reference_to_video` / `image` + `last_frame`) | start still | arrive still — **distinct** |
| **enter** | same | at-still | fill veil — **never** dest spawn |
| **breath** | `image_to_video` on **one** still | pose still | **same** still |

Never `image_to_video` a walk or enter on a single still. That invents the journey / clones the dog. Breath is the only legal `first = last`.

After **each** plate: `smoke(file, kind, refs)` ([SMOKE.md](SMOKE.md)). PASS writes `films/`. FAIL recooks **this** plate, cap 2.

## What the player may change

**Citadel style only.** Stone, crystal, neon, moss, gold temple, flooded ruin, anything — as long as it stays a hall with two doors.

## What is locked (pack)

| lock | value |
|---|---|
| Bolt | [CHAR.md](CHAR.md) · [`lock/bolt-back.jpg`](lock/bolt-back.jpg) |
| Camera | lock-off, 9:16, plate 720×1280 |
| Doors | **A = teal, left** · **B = gold, right** |
| Spawn | both doors in frame, Bolt center, back to camera |
| atA | Bolt at teal; gold still visible |
| atB | Bolt at gold; teal still visible |

Composition examples (camera + door layout, not the player's hall):

- [`lock/example-spawn.jpg`](lock/example-spawn.jpg)
- [`lock/example-at-a.jpg`](lock/example-at-a.jpg)
- [`lock/example-at-b.jpg`](lock/example-at-b.jpg)

## Player phrases (treat as this flow)

- "3 stills, citadel de cristal noir"
- "je veux un hall en pierre verte, style citadel"
- "StarBoltSprint citadel, stills, temple d'or"
- "create a citadel room" / "Bolt Engine living film" with a style
- "branche room 2 sur la porte A" → after both packs exist, [ENTER.md](ENTER.md) + [HANG.md](HANG.md)

If they give **no** style, cook the example hall (lock/example-*). If they give **7 videos**, skip still-cook — map and hang ([GROK.md](GROK.md)).

## Stills — order is law

Do **not** roll 3 separate text-to-image. One spawn. Two moves.

Room 1 → `stills/spawn.jpg` `stills/at-a.jpg` `stills/at-b.jpg`.
Room 2 → `stills/a/spawn.jpg` `stills/a/at-a.jpg` `stills/a/at-b.jpg`. **Do not overwrite room 1.**
Without `stills/a/` Grok writes over hall and the citadel dies.

### 1. spawn

`reference_to_image` · images: `lock/bolt-back.jpg` + `lock/example-spawn.jpg` · aspect `9:16`

Prompt slot:

> Same dog as the first image — cream German Shepherd, teal collar, back to camera, standing. Same camera and door layout as the second image: teal portal left, gold portal right, both fully visible, lock-off. Hall restyled as: **{player style}**. Photoreal 9:16. No face, no UI, no 3/4.

Save → `stills/spawn.jpg` (or `stills/a/spawn.jpg`). Scale 720×1280.

### 2. atA — from spawn, not from text

`image_to_image` · source = the spawn you just made

> Same hall, same camera, same light, same doors. Only the dog walks to the teal portal on the left and stops, still back to camera. Gold portal stays in frame. Feet on the floor.

Save → `stills/at-a.jpg` (or `stills/a/at-a.jpg`).

### 3. atB — from the same spawn

`image_to_image` · source = **spawn** (not atA)

> Same hall, same camera, same light, same doors. Only the dog walks to the gold portal on the right and stops, still back to camera. Teal portal stays in frame. Feet on the floor.

Save → `stills/at-b.jpg` (or `stills/a/at-b.jpg`).

### 4. Show the 3. Wait.

If any FAIL below, recook from spawn. Do not invent a fourth still. Do not cook films yet.

## Stills FAIL (recook)

- Bolt face / 3/4 / profile / different dog
- Doors swapped or missing (spawn must show **both**)
- Camera moved / zoomed / tilted
- Hall architecture morphs between spawn and atA/atB
- Plate not 9:16
- UI, text, watermark, chrome

## Films — only after the player oks the 3 stills

Stills **are** first and last frames. Do not re-imagine a new hall. **Law 0.**

**Walks and enter: first AND last must be distinct images.** Breath is the only legal `first = last` loop. Enter is **not** `image_to_video` on one still — `last = first` invents a journey / clone. See [HANG.md](HANG.md).

Room 1 films → `films/`. Room 2 films → `films/a/`.

| clip | tool | first | last | dur | law |
|---|---|---|---|---|---|
| breath-spawn | image_to_video on spawn | spawn | spawn | 6s | in-room: loop, feet glued |
| breath-A | image_to_video on atA | atA | atA | 10s | in-room: loop, feet glued |
| breath-B | image_to_video on atB | atB | atB | 10s | in-room: loop, feet glued |
| walk-spawn-A | reference_to_video spawn+atA | spawn | atA | 10s | back-to-camera the **whole** clip |
| walk-spawn-B | reference_to_video spawn+atB | spawn | atB | 10s | idem |
| walk-A-B | reference_to_video atA+atB | atA | atB | 10s | idem |
| walk-B-A | reference_to_video atB+atA | atB | atA | 10s | idem |

Walk prompt slot (every walk):

> Lock-off camera. Same hall. The cream German Shepherd with the teal collar walks slowly from the first frame pose to the last frame pose, always back to camera, never turning a 3/4 or a profile. Feet on the floor. Both portals stay in the hall. No face, no UI, no morph. 10 seconds.

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

## Walk FAIL (recook that clip, don't hang it)

- 3/4, profile, fashion-walk, face
- Bolt morph (coat, collar, extra limb)
- Hall morph, door color swap
- First frame ≠ start still / last frame ≠ arrive still (dissolve will not fix this)
- Cooked as `image_to_video` on one still (violates Law 0)

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
