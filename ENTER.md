# ENTER — room 1 → room 2 (threshold)

Walks stay in **one** hall. **Enter** is the only clip that changes room.
Repo: `https://github.com/StarBoltSprint/citadel-room`

Walk A ended → **breath-A**. Stay. The player chooses: tap A again = enter, or tap B = walk A→B.
**Never auto-enter** when a walk ends.

Engine clock (DOM, fades, still, veil): [ENGINE.md](ENGINE.md).

## Two plates. Never one cook.

```
Plaque A (Imagine) : atA of room 1 → teal full. STOP.
Plaque B           : spawn of room 2 (still + breath loop, already cooked).
Join               : engine, 500ms. Empty teal veil.
```

**Never** send `first = atA` **and** `last = Hall′ spawn` in the **same** Imagine clip.
First dog LEFT + last dog CENTER = **clone** (two Bolts). Proven. Frame 8 of the long cook.

## Same-slot (anti-clone)

Last still of plate A: the dog stays **where he is in first** — left, at teal, back.
The oval grows around **him**. He does not walk to the center of the floor.

| first | last | result |
|---|---|---|
| dog left | dog center (Hall′) | FAIL clone |
| dog left | dog left, teal full | PASS |
| dog left | empty teal | dog vanishes mid-clip — FAIL identity |

## Phrase (plate A) — paste as-is

```
ONE white GSD only. Never a second dog. Never a ghost.
6 seconds. Two steps INTO the left teal. He stays on the left.
Portal fills the frame. End ON the full teal. Do not reveal the next hall.
White fur readable. Back to camera. Locked-off.
```

First frame = `stills/at-a.jpg` of room 1.
Last frame = same-slot teal-full (`stills/seuil/teal-fill.jpg`) — i2i from atA: oval grows, dog does not move slot, gold may leave, **no Hall′**.

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

## Camera

```
yaw 0  pitch 0  dolly 0  orbit 0
hauteur et fov constants
```

Gold may leave the frame. Camera does not follow.

## Teal is a curtain, not a world

- Last of plate A = cyan full. **Do not reveal Hall′ in Imagine.**
- White fur readable the whole time. Never black dog, never contre-jour silhouette.
- The blue is a **rideau**. Hall′ was already behind it.

## Engine curtain (not Imagine)

```
last(A)  = full teal (1 dog, left)   then hide enter 0ms
           ↓  empty-teal veil on top
           ↓  500ms veil → 0
first(B) = spawn Hall′ (1 dog, center, posed, 2 doors)
```

**Never fade two images that both have a dog in different places.** Overlay = two ghosts.

Clean curtain = cyan **empty** (`stills/seuil/teal-empty.jpg`, i2i last frame, **remove the dog**) lifting onto Hall′.

During enter: still underlayer **opacity 0**. atA still + enter video = engine clone.
Into enter: cut **0ms** (first frame = atA). Curtain only on the way **out**.

Full clock: [ENGINE.md](ENGINE.md).

## Hall′ is another plate

- Spawn of room 2 = still in loop. **Posed.** Not a walk.
- Enter **stops** on full teal (~6–7s). It does not keep walking in Hall′.
- Breath Hall′ ≠ enter. Do not let the seuil clip overflow.

## Room 2 stills vs room 1

Room 2 is **not** a morph of room 1. Full pack (3 stills + 7 films), **same grammar**. Style changes. The shot does not.

### Must match (else enter breaks)

| lock | room 1 | room 2 | if it drifts |
|---|---|---|
| **Bolt** | cream GSD, back, teal collar | **the same** | other dog / black / clone |
| **Scale** | lower third, not a giant | **same screen size** | curtain reads as a travelling |
| **Depth** | same camera distance | **same depth of field** | see below |
| **Camera** | lock-off, 9:16, 720×1280 | **same height / same FOV** | zoom, tilt, dolly |
| **Doors** | A teal **left**, B gold **right** | **same** | fork unreadable |
| **Spawn** | center, back, **2** doors | center, back, **2** doors | last Hall′ ≠ plate B |
| **atA** | at teal, gold **still visible** | at teal, gold still visible | room 2 walk A breaks |
| **atB** | at gold, teal still visible | at gold, teal still visible | same for B |

Short law: **same photo, other hall.**

Bolt occupies the **same rectangle** in spawn₂ as in spawn₁. Not bigger. Not deeper. That is what stops the curtain from "zooming".

### May change (that is the point)

- Architecture (sci-fi vs gothic / rose window / candles / vines)
- Floor, ceiling, light
- Wall material

Not the doors. Not Bolt. Not the camera.

### How room 2 stills are cooked

**Not** i2i from a room 1 still. Independent pack, [COOK.md](COOK.md):

```
spawn₂  = bolt-back + example-spawn + room 2 style
atA₂    = i2i from spawn₂  (dog → teal, hall frozen)
atB₂    = i2i from spawn₂  (dog → gold, hall frozen)
```

Room 1 spawn is **not** a source. Otherwise you recook a hall morph.

### Exact relation to enter

```
still room 1 atA     →  first of plate A
still room 2 spawn   →  plate B (after the curtain)
```

They **never** meet in the same Imagine cook.

So spawn₂ must already be the arrival photo:

- back, **center**, 2 ovals
- **same scale as spawn₁**
- posed (not a walk)

### Spawn₂ must not be

- One door only
- Dog on the left (that is atA, not spawn)
- Face / profile / 3/4
- Other breed, collar gone, two Bolts
- Plate not 9:16

atA₂ / atB₂: **same hall as spawn₂**. Only Bolt translates. If the architecture changes between spawn₂ and atA₂ → FAIL, recook from spawn₂. Same as room 1.

## Depth — same plan as room 1

**Yes. Same depth of field.**

Spawn₂ = same camera distance as spawn₁: dog **lower third**, two ovals in the same place in the frame, floor receding the same way.

If room 2 is deeper (smaller dog, nave fleeing) or closer (bigger dog), the 500ms curtain **reads as a travelling**. The camera did not move — the stills are not the same scale.

Different architecture. **Same photograph.**

## Cook order — branch door A onto room 2

1. Room 1 already hangs (3 stills + 7 films, [COOK.md](COOK.md)).
2. Cook **room 2** as a full pack: 3 stills then 7 films. Same Bolt ([CHAR.md](CHAR.md)), same camera, **same depth**, teal left / gold right. Show stills. Wait.
3. Last still for enter: i2i from room1 `at-a.jpg` — oval grows around the **same-slot** dog, teal fills, no Hall′. Save `stills/seuil/teal-fill.jpg`.
4. Cook plate A: `first=at-a.jpg` `last=teal-fill.jpg` 6s 9:16. Prompt above. QC every second: **one** white dog, back, no Hall′ leak.
5. Empty veil: i2i last frame of that clip, **remove the dog**. Save `stills/seuil/teal-empty.jpg`.
6. Wire: `atA` of room 1, **second tap A** → `enter-hall-a` → switch room → `breath-spawn` of room 2 with 500ms empty-teal veil. Clock: [ENGINE.md](ENGINE.md).
7. Optional return: same laws, `enter-a-hall` from room 2 atA → room 1 spawn.

Open is still **breath-spawn of room 1**. Chrome dégage.

## Files

| file | what |
|---|---|
| `films/enter-hall-a.mp4` | plate A, hall → room a |
| `films/enter-a-hall.mp4` | optional return |
| `stills/seuil/teal-fill.jpg` | last of plate A (dog left, teal full) |
| `stills/seuil/teal-empty.jpg` | veil, no dog |

Plate every mp4 **720×1280** H264, no audio.

## Player (enter)

1. `spawn` tap A = **walk**. Never enter. Must arrive at the door first.
2. `atA` tap A = **enter** if a link exists, else stay.
3. `atA` tap B = walk A→B (still in room 1).
4. During enter = ignore taps.
5. `ended(enter)` → switch room → `breath-spawn` of dest. Pose = spawn.
6. Hide enter video **0ms**, veil on, dest breath under, veil 500ms → 0.
7. Still opacity 0 for the whole enter.

## QC (ship only if)

```
0–1s   atA, 1 dog, white, back     PASS
2–4s   2 steps into teal, lock     PASS
5s     oval takes the frame, white PASS
6–7s   full teal, back, white      PASS  ← last of Imagine
then   empty veil 500ms            engine
then   Hall′ spawn posed, 1 dog    PASS  ← other plate
```

Any second body, any Hall′ leak inside the 6s, any black dog → recook plate A. Do not hang it.
