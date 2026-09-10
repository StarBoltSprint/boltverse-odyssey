# HANG — how the pack lands in the player

This GitHub repo is the **recipe**, not the running hall.
`stills/` and `films/` at root are empty (`.gitkeep`). Hung discs live in `packs/<id>/`. Grok cooks there and the player at https://boltverse-odyssey.grok.me fetches them.

Repo: `https://github.com/StarBoltSprint/citadel-room`

## Validate the box

```
node scripts/validate-pack.mjs packs/<id>
```

FAIL → do not hang, do not give the URL. [VALIDATE.md](VALIDATE.md).
This is shape (json + stills + films + encode). Not Smoke (Bolt / clone / first-last).

## Multi-room folders (do not overwrite room 1)

Room 1 = hall (root of the pack). Room 2 = folder `a`. Seuil stills = `seuil/`.

```
stills/spawn.jpg
stills/at-a.jpg
stills/at-b.jpg
stills/a/spawn.jpg          ← room 2
stills/a/at-a.jpg
stills/a/at-b.jpg
stills/seuil/teal-fill.jpg  ← last of enter A (1 dog, left)
stills/seuil/teal-empty.jpg ← veil A, 0 dogs
stills/seuil/gold-fill.jpg  ← last of enter B (if door B branches)
stills/seuil/gold-empty.jpg ← veil B, 0 dogs

films/breath-spawn.mp4 … walk-b-a.mp4     ← room 1 (the 7)
films/a/breath-spawn.mp4 … walk-b-a.mp4   ← room 2 (the 7)
films/enter-hall-a.mp4                    ← NOT in the 7
films/enter-a-hall.mp4                    ← optional return
films/enter-hall-b.mp4                    ← only if door B branches
```

Cook room 2 **into `stills/a/` + `films/a/`**. If you write `stills/spawn.jpg` again you erase hall.

## PACK cache-bust

Every src is `file?${PACK}` (`u26`, `u27`, …).

After you replace **any** mp4 or still: bump `PACK` in the player (`room.ts` / `room.json`). One integer. If you do not bump, the browser keeps the old clip and you debug a ghost.

Enter clips too: `/films/enter-hall-a.mp4?${PACK}`.
Veil too: `/stills/seuil/teal-empty.jpg?${PACK}`.

## Encode (every mp4)

```
ffmpeg -i in.mp4 -map 0:v:0 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -an -movflags +faststart out.mp4
```

- Plate **720×1280** 9:16. Non-9:16 → center-crop then scale.
- **No audio** (`-an`). Audio = autoplay dead.
- `yuv420p` + `+faststart` — Safari / Chrome.
- Stills: same scale/crop, jpeg.

## Imagine — first AND last must be distinct (walks + enter)

Walks: `first = start still`, `last = arrive still`. Different images.
Enter: `first = atA`, `last = same-slot teal-full` (or gold-full). Different images. **Never** `last = Hall' spawn`.

Breath: `first = last = pose still` (the one legal loop).

If enter is cooked as `image_to_video` on a single still, Imagine invents a journey (morph / tunnel / clone). Enter **requires** the first+last-frame call (`image` + `last_frame`), 6s, 9:16.

`last = first` on a walk or enter = FAIL. Recook. Dissolve will not fix it.

## Breath dest = freeze if it walks

Law: dest breath after enter is **posed**. Feet glued. Hall frozen.

If `image_to_video` on spawn2 still walks / turns / leaves spawn → **do not hang it**. Replace with a still loop:

```
ffmpeg -loop 1 -i stills/a/spawn.jpg -t 6 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -r 24 -an -movflags +faststart \
  films/a/breath-spawn.mp4
```

Better a freeze than a second walk across Hall' after the curtain.

## Enter is outside the 7

The 7 clips live in `room.clips` (per room). Enter does **not**.

```
ENTER[hall].A = { to: "a", clip: enter-hall-a }
ENTER[a].A    = { to: "hall", clip: enter-a-hall }   // optional return
ENTER[hall].B = { to: …, clip: enter-hall-b }         // only if door B branches
```

`enterFor(spawn, *)` = null.
`enterFor(atA, A)` / `enterFor(atB, B)` only.

```
onEnterEnded(played):
  roomRef = played.to        // switch FIRST
  poseRef = "spawn"
  startBreath("spawn")       // pack() now reads dest clips + dest still
```

If you startBreath before switching room, you play hall breath-spawn under the veil = wrong plate.

Preload enter clips **separately** — they are not in `Object.values(room.clips)`.

## Veil follows the door, not always teal

| door entered | fill last (1 dog, same slot) | empty veil (0 dogs) |
|---|---|---|
| **A** (teal, left) | `stills/seuil/teal-fill.jpg` | `stills/seuil/teal-empty.jpg` |
| **B** (gold, right) | `stills/seuil/gold-fill.jpg` | `stills/seuil/gold-empty.jpg` |

Hardcoding `TEAL_VEIL` on a gold enter = cyan shutter on a gold threshold. FAIL.
`veilRef.src` = empty still of **that** door before opacity 1.

## Play flags (iOS)

On every `<video>` (DOM + preload + kick):

```
muted = true
defaultMuted = true
playsInline = true
autoplay = false
```

`muted=true` **before** `play()`. Unmute only the already-visible film, on a real pointer.
Without `playsInline`, iOS goes fullscreen and kills the hall.

## One line

Room 2 in `a/`. Seuil in `seuil/`. Bump PACK. First ≠ last on enter. Freeze dest breath if it walks. Veil color = the door. Enter lives in `ENTER{}`, switch room, then breath dest. Validate before hang.
