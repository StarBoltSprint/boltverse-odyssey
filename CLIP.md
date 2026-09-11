# CLIP — does this film have the right to enter `films/`?

Not “is it pretty.” Three gates, in order. The first **no** stops everything.

After Imagine (or ffmpeg), **before** Hang / PACK. Breath, walk, enter: same machine, slightly different rules.

```
raw file  →  encode  →  smoke clip  →  PASS : write films/<id>.mp4
                              FAIL : recook (max 2) or freeze the still
```

The official still for the pose already exists. The clip is judged **against** it.

## Gate 1 — The file

`ffprobe` + crop. Layer A ([SMOKE.md](SMOKE.md) [VALIDATE.md](VALIDATE.md)).

- 720×1280 after `scale+crop`
- H264, `yuv420p`, **no audio**
- `+faststart`
- duration in window:

| kind | window |
|---|---|
| breath-spawn | ~6s |
| breath-at | ~10s |
| walk | **8s** (6–9). 6s = still mid-hall. 10s = leftover → round trip |
| enter | ~6s |

Off-plate = the player jumps at swap. FAIL `plate.size` / `plate.audio` / `plate.duration`. Do **not** call vision.

## Gate 2 — The graph (first / last)

Extract **first** and **last** frames. Compare to official stills (perceptual hash ([PHASH.md](PHASH.md)) + [STILL-PAIR.md](STILL-PAIR.md)).

| Clip | first ≈ | last ≈ |
|---|---|---|
| breath-spawn | spawn | spawn (same picture) |
| breath-A | atA | atA |
| walk-spawn-A | spawn | atA |
| walk-A-B | atA | atB |
| enter-A | atA | teal-fill (same slot, **not** Hall′ spawn) |

Dry rules:

- breath: `first ≈ last`, else a walk in disguise → `graph.breath_drift`
- walk / enter: `first ≠ last` (two files). `first == last` → Imagine invented the trip → FAIL
- walk last ≠ official at-still → `graph.last_not_official`
- enter last ≈ neighbor spawn → clone, `graph.enter_reveals_hall`

Player dissolve does not fix this. Recook the clip, do not “fade longer.”

**Lock-off hash trap:** spawn vs at-B whole-frame ham 6 can still be a size pop. Last vs official still uses `gate.size` (`bboxH/H`). You do not type PASS because the hall looks locked.

**Barrier:** `node scripts/smoke-pack.mjs <file> --kind walk` — exit 1 = do not write `films/`. Eyes on the Grok preview are not Smoke.

## Gate 3 — Identity + hall (3 pictures)

Frames: **t=0, mid, last**. Vision (Grok + [SMOKE.md](SMOKE.md) C). Output = a **code**, not a poem.

Immediate FAIL:

- face, muzzle, ¾, profile at spawn
- 2nd dog / ghost
- black silhouette
- text / UI / 3rd door
- teal or gold cropped (except last 1–2s of **enter**, where the oval may eat the frame)
- paws sliding down, ceiling falling (dolly / tilt)
- breath: a step, the hall advancing
- enter: Hall′ appearing *inside* the 6s, dog walking to center

Typical PASS: back, 4 paws, readable white, 2 doors (walk/breath), lock identical to sibling stills.

Do **not** lint tap-glow in v1. That is [PLAY.md](PLAY.md), not the hall.

## After the verdict

```
walk-spawn-A PASS
breath-A FAIL graph.breath_drift
enter-hall-a FAIL identity.clone @ t=mid
```

- **PASS** → `films/` and **only then** the next clip
- **FAIL** → do not touch the stills. Recook **this** clip from the same first/last. Counter 2
- Still FAIL:
  - breath → ffmpeg loop of the still (a freeze beats a step)
  - walk → do not Hang that edge (tap = stay)
  - enter → no edge; hall 1 stays playable

Never write a FAIL into `films/`. Never a spinner on Bolt while waiting: stock or last good. [HOLD.md](HOLD.md)

## Cook order (floor 1)

Do not smoke 5 films in parallel before the stills.

1. stills PASS (else no refs → no gate 2)
2. breath-spawn
3. walks spawn→A / spawn→B (need last = at-stills)
4. breath-A / breath-B

A↔B only if both at-stills **and** both walks-to-sill PASS (floor 2).  
Enter is off this queue (floor 3).

## What this is not

- not a human saying “almost”
- not a crop to hide a muzzle
- not “we’ll see at playtest”
- not validating tap glow in v1

## One line

Measure the file, glue first/last to the official stills, refuse the face. What exits may be an edge. The rest does not exist for the player.


## Walk last frame — clone.two_dogs (hard)

Frost walk-A (2026-09-10): 0–12s ONE dog to teal = PASS. **t=13s** a second Bolt pops at spawn/center. FAIL. Do not hang.

Imagine interpolates spawn (center) and atA (sill) → it **draws both** at the end.

```
last 2s of a walk = ONE dog, on the arrive still, back to camera.
A second body at spawn / mid-hall / ghost = FAIL clone.two_dogs @ t=last
```

Recook **this** walk only, cap 2. Same first + last stills. Prompt hard:

```
ONE white GSD only. Never a second dog. Never a ghost. Never a spawn dog plus a door dog.
He ends already at the arrive still. No walk-back to center.
```

Still FAIL → drop the edge (tap = stay). Never write the clone into `films/`.

## Walk is one trip (hard)

Frost walk-B (2026-09-10): spawn → gold 0–10s PASS. **t=11s SNAP back to spawn**, then gold again. FAIL `graph.walk_return`.

A walk never returns home. One body, spawn → sill, stop. No loop inside the mp4. No teleport.

```
mid-clip (t > 40%) ≈ spawn still → FAIL graph.walk_return
`last_frame` sticks the **last picture**, not the journey. 10s: arrive at 2s, empty 8s → he walks home then last_frame yanks him back. Mid ≈ spawn = `graph.walk_return` (true, not vapor). Recook **8s**. Arrive ~5s, hold. Hold at the door. Do not hang a 10s loop and trim.
loop=false. ended → breath-arrive, never replay the walk.
```

Walk cook = API `last_frame`, not chat `reference_to_video`. If last overshoots the still, recook. Do not replace the still with the fat frame.

## Walk last vs at-still (size)

`last_frame` can still miss. Gel at t=end = fat dog at teal (**0.52**) while official at-A is tiny (**0.15**). `graph.last_gray` ham 14 = not the same picture.

- at-A / at-B still **must** be sill-band **0.35–0.40** (FAIL < 0.28 or > 0.45). 0.15 is a spawn-scale dog standing at the door — recook the **still**.
- Walk last must match that still. 0.52 vs 0.15 = `gate.size` + `graph.last_not_official`. Recook the walk (6s) or the still. **Do not** replace the small still with the fat last.

## Why last_frame “sometimes” misses

Imagine treats `last_frame` as a **target**, not a paste. If spawn is 0.19 and at-A is 0.50, the jump is too far: it keeps the start. Last = spawn. `graph.last_not_official`. Not a stamp.

`walk_return @ t=2.4` on a **6s** clip is the outbound step (40% = still leaving spawn). Real return is **after** ~3.2s. Ice/cream floor also inflates sill `creamHeight` (0.50) — floor is not the dog.

Recook at-A in **0.35–0.40** with a dark floor, then 6s walk. Cap 2 → tap stays spawn. Correct.
