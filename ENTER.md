**`to` comes from [adjacency.json](adjacency.json).** Not free text. Not biomes.json.

# ENTER — room 1 → room 2 (threshold)

Walks stay in **one** hall. **Enter** is the only clip that changes room.
Repo: `https://github.com/StarBoltSprint/citadel-room`

Walk A ended → **breath-A**. Stay. The player chooses: tap A again = enter, or tap B = walk A→B.
**Never auto-enter** when a walk ends.

Engine clock: [ENGINE.md](ENGINE.md).
Folders / PACK / encode / freeze / gold veil: [HANG.md](HANG.md).

## Folders — do not overwrite room 1

Room 2 is **not** `stills/spawn.jpg` again.

```
stills/          room 1 (hall)
stills/a/        room 2          ← spawn.jpg at-a.jpg at-b.jpg
stills/seuil/    fill + empty veil (teal and/or gold)
films/           room 1 × 7
films/a/         room 2 × 7
films/enter-hall-a.mp4   NOT in the 7
```

If you write room 2 into `stills/spawn.jpg` you erase hall. COOK without `a/` = Grok overwrites room 1.

After hanging any new mp4/still: bump `PACK` (`?uN`). No bump = browser replays the old clip.

## Two plates. Never one cook.

```
Plaque A (Imagine) : atA of room 1 → teal full (or gold full). STOP.
Plaque B           : spawn of room 2 in stills/a/ (still + breath).
Join               : engine, 500ms. Empty veil of THAT door.
```

**Never** send `first = atA` **and** `last = Hall′ spawn` in the **same** Imagine clip.
First dog LEFT + last dog CENTER = **clone** (two Bolts). Proven. Frame 8 of the long cook.

## Imagine — first AND last distinct

Enter is **not** `image_to_video` on one still. That invents a journey (morph / tunnel / clone).

```
first  = stills/at-a.jpg              (room 1, dog left)
last   = stills/seuil/teal-fill.jpg   (same-slot dog, teal full, NO Hall′)
```

Two different files. `last = first` = FAIL. Recook.
Breath is the only legal `first = last` loop. Walks and enter must have distinct frames.
Call: `image` + `last_frame`, 6s, 9:16. Prompt below.

Door B: `first = stills/at-b.jpg`, `last = stills/seuil/gold-fill.jpg`.

## Same-slot (anti-clone)

Last still of plate A: the dog stays **where he is in first** — left, at teal, back.
The oval grows around **him**. He does not walk to the center of the floor.

| first | last | result |
|---|---|---|
| dog left | dog center (Hall′) | FAIL clone |
| dog left | dog left, teal full | PASS |
| dog left | empty teal | dog vanishes mid-clip — FAIL identity |
| same file first=last | — | FAIL, Imagine invents the trip |

## Phrase (plate A) — paste as-is

```
ONE white GSD only. Never a second dog. Never a ghost.
6 seconds. Two steps INTO the left teal. He stays on the left.
Portal fills the frame. End ON the full teal. Do not reveal the next hall.
White fur readable. Back to camera. Locked-off.
```

Duration **6s**. Longer = clone time. Trim salvage is not a cook.

## Act

```
atA (back, teal) → 2–3 steps INTO the teal → oval fills the frame ~2s → HOLD last
```

The oval **takes the frame**. It does not advance toward the camera (that is a dolly).
Full teal = 1–2s max, then STOP.

### Interdit (FAIL — recook)

| sin | why |
|---|---|
| Reculer vers le centre | morph de salle, pas un seuil |
| Marcher G → milieu au sol | pont de positions = clone |
| Profil / face / 3/4 | identité |
| Dolly / tunnel / vortex 5s | la caméra voyage |
| Le décor qui fond autour de lui | volet de théâtre |
| Last révèle Hall′ | Imagine relie deux chiens |
| Silhouette noire | identité (poil blanc lisible) |
| Deux chiens / ghost | clone |
| Clip > 8s | il a le temps de cloner |
| `image_to_video` on one still | Imagine invents the trip |
| Room 2 written over `stills/spawn.jpg` | hall erased |

## Camera

```
yaw 0  pitch 0  dolly 0  orbit 0
hauteur et fov constants
```

Gold may leave the frame on an A enter. Camera does not follow.

## Veil follows the door — not always teal

The blue (or gold) is a **rideau**, not a world. Hall′ was already behind it.

| door | fill last (1 dog, same slot) | empty veil (0 dogs) |
|---|---|---|
| **A** teal left | `stills/seuil/teal-fill.jpg` | `stills/seuil/teal-empty.jpg` |
| **B** gold right | `stills/seuil/gold-fill.jpg` | `stills/seuil/gold-empty.jpg` |

Hardcoding teal-empty on a gold enter = cyan shutter on a gold threshold. FAIL.
Empty veil = i2i last frame of plate A, **remove the dog**.

White fur readable the whole plate A. Never black dog, never contre-jour silhouette.
**Do not reveal Hall′ in Imagine.**

## Engine curtain (not Imagine)

```
last(A)  = full portal (1 dog, same slot)  then hide enter 0ms
           ↓  empty veil of THAT door on top
           ↓  500ms veil → 0  (double rAF)
first(B) = spawn Hall′ (1 dog, center, posed, 2 doors)
```

**Never fade two images that both have a dog in different places.** Overlay = two ghosts.

During enter: still underlayer **opacity 0**. atA still + enter video = engine clone.
Into enter: cut **0ms** (first frame = atA). Curtain only on the way **out**.

Full clock: [ENGINE.md](ENGINE.md).

## Dest breath = freeze if it walks

Plate B = `stills/a/spawn.jpg` + `films/a/breath-spawn.mp4`.

In-room breaths (the 7) may micro-head. **Dest breath after enter must be posed.**
If `image_to_video` on spawn₂ walks / turns / leaves center → **do not hang it**. Loop the still:

```
ffmpeg -loop 1 -i stills/a/spawn.jpg -t 6 \
  -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280" \
  -c:v libx264 -pix_fmt yuv420p -r 24 -an -movflags +faststart \
  films/a/breath-spawn.mp4
```

Better a freeze than a second walk across Hall′ after the curtain.
Enter **stops** on full portal (~6s). It does not keep walking in Hall′.

## Enter is outside the 7

```
ENTER[hall].A = { to: "a", clip: enter-hall-a }     // teal veil
ENTER[hall].B = { to: …,   clip: enter-hall-b }     // gold veil
ENTER[a].A    = { to: "hall", clip: enter-a-hall }  // optional return
```

Not in `room.clips`. Preload separately.

```
onEnterEnded(played):
  roomRef = played.to     // switch FIRST
  poseRef = "spawn"
  startBreath("spawn")    // pack() now reads stills/a + films/a
```

If you breath before the switch, hall spawn plays under the veil.

## Room 2 stills vs room 1

Room 2 is **not** a morph of room 1. Full pack into `stills/a/` + `films/a/`. Style changes. The shot does not. **Same depth.**

| lock | room 1 | room 2 | if it drifts |
|---|---|---|
| **Bolt** | cream GSD, back, teal collar | **the same** | other dog / black / clone |
| **Scale** | lower third | **same screen size** | curtain = travelling |
| **Depth** | same camera distance | **same depth of field** | fake dolly |
| **Camera** | lock-off, 9:16, 720×1280 | **same height / FOV** | zoom, tilt |
| **Doors** | A teal **left**, B gold **right** | **same** | fork unreadable |
| **Spawn** | center, back, **2** doors | center, back, **2** doors | last Hall′ ≠ plate B |

Cook independently (COOK.md). Room 1 spawn is **not** a source.

```
spawn₂  = bolt-back + example-spawn + room 2 style  → stills/a/spawn.jpg
atA₂    = i2i from spawn₂                            → stills/a/at-a.jpg
atB₂    = i2i from spawn₂                            → stills/a/at-b.jpg
```

Spawn₂ = arrival photo: back, **center**, 2 ovals, **same scale as spawn₁**, posed.

## Cook order — branch door A onto room 2

1. Room 1 already hangs.
2. Cook room 2 into **`stills/a/` + `films/a/`**. Same Bolt, same camera, **same depth**. Show stills. Wait.
3. i2i from room1 `at-a.jpg` → oval grows, same-slot, teal fills, no Hall′. Save `stills/seuil/teal-fill.jpg`.
4. Plate A: `first=at-a.jpg` `last=teal-fill.jpg` 6s 9:16. QC every second: **one** white dog, back, no Hall′ leak.
5. Empty veil: i2i last frame, **remove the dog**. Save `stills/seuil/teal-empty.jpg`. (Door B → gold-fill / gold-empty.)
6. Dest breath: if i2v walks, freeze `stills/a/spawn.jpg` → `films/a/breath-spawn.mp4`.
7. Wire `ENTER[hall].A`. Second tap A → enter → **switch room** → dest breath under empty veil 500ms.
8. Bump `PACK`.

Open is still **breath-spawn of room 1**. Chrome dégage.

## Files

| file | what |
|---|---|
| `stills/a/*.jpg` | room 2 stills |
| `films/a/*.mp4` | room 2 × 7 |
| `films/enter-hall-a.mp4` | plate A, hall → room a |
| `films/enter-hall-b.mp4` | only if door B branches |
| `films/enter-a-hall.mp4` | optional return |
| `stills/seuil/teal-fill.jpg` | last of enter A |
| `stills/seuil/teal-empty.jpg` | veil A, 0 dogs |
| `stills/seuil/gold-fill.jpg` | last of enter B |
| `stills/seuil/gold-empty.jpg` | veil B, 0 dogs |

Plate every mp4 **720×1280** H264 yuv420p +faststart, **no audio**. Then bump PACK.

## Player (enter)

1. `spawn` tap A = **walk**. Never enter.
2. `atA` tap A = **enter** if a link exists, else stay.
3. `atA` tap B = walk A→B (still in room 1).
4. During enter = ignore taps.
5. `ended(enter)` → **switch room first** → dest `breath-spawn`.
6. Hide enter **0ms**, veil of **that door** on, dest under, veil 500ms → 0 (double rAF).
7. Still opacity 0 for the whole enter.
8. `muted` + `playsInline` before every `play()`.

## QC (ship only if)

```
0–1s   atA, 1 dog, white, back     PASS
2–4s   2 steps into teal, lock     PASS
5s     oval takes the frame, white PASS
6–7s   full teal, back, white      PASS  ← last of Imagine
then   empty veil 500ms            engine (color = the door)
then   Hall′ spawn posed, 1 dog    PASS  ← films/a/breath-spawn (freeze if walks)
```

Any second body, any Hall′ leak inside the 6s, any black dog → recook plate A. Do not hang it.
