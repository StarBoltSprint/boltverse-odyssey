**Hall `to`** = [adjacency.json](adjacency.json). **Lane `to`** = a `BiomeId`, then [HANDOFF.md](HANDOFF.md).

# ENTER — threshold (hall→hall or hall→Lane)

Walks stay in **one** hall. **Enter** is the only clip that changes disc.
Repo: `https://github.com/StarBoltSprint/boltverse-odyssey`

Walk A ended → **breath-A**. Stay. The player chooses: tap A again = enter, or tap B = walk A→B.
**Never auto-enter** when a walk ends.

Lane: 2nd tap only if `coming === false` and `calm-1` is on disk. Else **stay**. Last(enter) = fill/veil — **not** Lane spawn. First of calm-1 **kisses** that hold. `m` / `t_run` born at 0 when hid plays. Five states: [HANDOFF.md](HANDOFF.md).

Engine clock: [ENGINE.md](ENGINE.md). Folders / PACK / encode / freeze / gold veil: [HANG.md](HANG.md).

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
Plaque B           : hall→hall = spawn of room 2 in stills/a/
                     hall→Lane  = first still of calm-1 (not citadel spawn)
Join               : engine, 500ms. Empty veil of THAT door.
```

**Never** send `first = atA` **and** `last = dest spawn` in the **same** Imagine clip.
First dog LEFT + last dog CENTER = **clone** (two Bolts). Proven.

## Imagine — first AND last distinct

Enter is **not** `image_to_video` on one still.

```
first  = stills/at-a.jpg              (room 1, dog left)
last   = stills/seuil/teal-fill.jpg   (same-slot dog, teal full, NO dest hall/Lane)
```

Two different files. `last = first` = FAIL. Recook.
Breath is the only legal `first = last` loop.
Door B: `first = stills/at-b.jpg`, `last = stills/seuil/gold-fill.jpg`.

## Same-slot (anti-clone)

Last still of plate A: the dog stays **where he is in first** — left, at teal, back.
The oval grows around **him**. He does not walk to the center of the floor.

| first | last | result |
|---|---|---|
| dog left | dog center (Hall′ / Lane spawn) | FAIL clone |
| dog left | dog left, teal full | PASS |
| same file first=last | — | FAIL, Imagine invents the trip |

## Phrase (plate A)

```
ONE white GSD only. Never a second dog. Never a ghost.
6 seconds. Two steps INTO the left teal. He stays on the left.
Portal fills the frame. End ON the full teal. Do not reveal the next hall.
White fur readable. Back to camera. Locked-off.
```

Duration **6s**. Longer = clone time.

## Act

```
atA (back, teal) → 2–3 steps INTO the teal → oval fills the frame ~2s → HOLD last
```

### Interdit (FAIL — recook)

Reculer vers le centre · Marcher G → milieu · Profil / face · Dolly / tunnel · Last révèle Hall′ ou calm-1 · Deux chiens · Clip > 8s · `image_to_video` on one still · Room 2 over `stills/spawn.jpg`.

## Veil follows the door

The blue (or gold) is a **rideau**, not a world.

| door | fill last (1 dog, same slot) | empty veil (0 dogs) |
|---|---|---|
| **A** teal left | `stills/seuil/teal-fill.jpg` | `stills/seuil/teal-empty.jpg` |
| **B** gold right | `stills/seuil/gold-fill.jpg` | `stills/seuil/gold-empty.jpg` |

## Engine curtain (not Imagine)

```
last(A)  = full portal (1 dog, same slot)  then hide enter 0ms
           ↓  empty veil of THAT door on top  (double rAF)
           ↓  500ms veil → 0
first(B) = hall dest spawn  OR  Lane calm-1 still  (under the veil)
```

**Never fade two images that both have a dog in different places.**
During enter: still underlayer **opacity 0**.

Hall dest breath = freeze if it walks ([HANG.md](HANG.md)). Lane dest = [HANDOFF.md](HANDOFF.md).

## Enter is outside the 7

```
ENTER[hall].A = { to: "a", clip: enter-hall-a }                 // hall
ENTER[hall].B = { kind: "sprint", to: "forest", clip: enter-b } // Lane
```

Not in `room.clips`.

```
onEnterEnded(played):
  if played.kind === "sprint":  // HANDOFF.md
    m = 0.12; t_run = 0; kick calm-1 under veil
  else:
    roomRef = played.to
    startBreath("spawn")
```

## Player (enter)

1. `spawn` tap A = **walk**. Never enter.
2. `atA` tap A = **enter** if a link exists, else stay.
3. During enter / handoff = ignore taps.
4. `ended(enter)` → switch first → dest under empty veil 500ms.
5. `muted` + `playsInline` before every `play()`. Plate `-an`.

## QC (ship only if)

```
0–1s   atA, 1 dog, white, back     PASS
2–4s   2 steps into teal, lock     PASS
5s     oval takes the frame        PASS
6–7s   full teal, back, white      PASS  ← last of Imagine
then   empty veil 500ms            engine
then   dest posed, 1 dog           PASS  ← Hall′ spawn freeze  OR  calm-1
```

Any second body, any dest leak inside the 6s → recook plate A.
