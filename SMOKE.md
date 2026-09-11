# SMOKE — fridge door

Architecture of the lock: [SAS.md](SAS.md). Three gates: [CLIP.md](CLIP.md). Hash: [PHASH.md](PHASH.md). Silent: [FAIL.md](FAIL.md).

# SMOKE — fridge door (not a sermon)

`#704` is the list. The machine is `smoke(file, kind, refs) → PASS | FAIL + a rule`.

Nobody "judges" a plate. The function says no, and `films/` gets nothing.

## Signature

```
smoke(file, kind, refs) →
  { ok: true }
  { ok: false, rule: "identity.face", at: "t=last", note: "muzzle" }
```

- `kind`: `still-spawn` | `still-atA` | `still-atB` | `breath` | `walk` | `enter`
- `refs`: official PASS stills (`spawn.jpg`, `at-a.jpg`, `at-b.jpg`) + lock examples

```
node scripts/smoke-pack.mjs packs/<id>
node scripts/smoke-pack.mjs packs/<id>/films/walk-spawn-a.mp4 --kind walk
```

Call it **before** writing `films/` or bumping PACK. FAIL = recook **this** plate (cap 2) or keep the last good plate.

## Barrier, not a stamp

You do **not** write `PASS`. Eyes on a preview are not Smoke.

```
node scripts/smoke-pack.mjs packs/<id>/films/walk-spawn-b.mp4 --kind walk
echo $?    # 0 hang this file. 1 recook. Never type PASS.
```

A Grok that ships then waits for the player's recording is **the player acting as Smoke**. Illegal. FAIL before `films/`. Cap 2. Then stock.

### Lock-off hash trap

Whole-frame pHash on a lock-off hall is ~90% stone. Spawn and at-B can hash **ham 6** while the dog **pops** (tiny still vs giant last). That is not PASS.

Walk last vs arrive still = **size** (`bboxH/H`, [SIZE.md](SIZE.md)) + pair. `gate.size` FAIL even if pHash says same. Hamming 0 on the dog, not on the vault.

Solid: last frame of the walk **is** the arrive still. If last ≠ still, recook the walk. Do not "fix" by replacing the still with the fat frame.


Log line, not a decree:

```
walk-spawn-A FAIL graph.last_not_official (last ≠ at-a.jpg)
breath-A PASS
atB FAIL identity.face @ still
```

## Three layers (not one AI)

### A. File (free, immediate)

- image/video decodes
- after crop: **720x1280**
- mp4: H264, `yuv420p`, **no audio**
- duration ≈ 6s breath-spawn / ≈10s breath-A/B and walks / ≈ 6s enter

Does not say it is Bolt. Says the player can play it.

Rules: `file.decode` `file.size` `file.codec` `file.pix_fmt` `file.audio` `file.duration`

### B. Graph (pixels, no opinion)

Compare **first** and **last** frame to the official still (aHash, ham < 12 ≈ same):

| kind | rule |
|---|---|
| breath | first ≈ last ≈ pose still |
| walk-spawn-A | first ≈ spawn, last ≈ atA |
| walk-A-B | first ≈ atA, last ≈ atB |
| enter | first ≈ at-still, last ≈ fill veil, **not** Hall' spawn |

Rules: `graph.first_eq_last` `graph.first_not_official` `graph.last_not_official` `graph.last_is_dest_spawn` `clone.two_dogs` plus **still-pair** `gate.rig` `gate.size` `gate.yaw` `gate.place` `gate.ncc` ([STILL-PAIR.md](STILL-PAIR.md))

Drift of last frame → `graph.last_not_official`. Dissolve does not fix it.

Still-pair: SSIM the hall, PCA/NCC the back. One far signal = illegal edge. [STILL-PAIR.md](STILL-PAIR.md).

### C. Identity + hall (vision, 3 frames)

Video: t = 0, mid, last (script writes `.smoke/<clip>/{first,mid,last}.jpg`). Still: the photo.

Grok vision. Prompt: [scripts/smoke-identity.md](scripts/smoke-identity.md). You are not kind to a profile wolf.

Hard FAIL, one rule code, no paragraph:

- `identity.face` `identity.muzzle` `identity.look` `identity.profile` `identity.three_quarter`
- `clone.two_dogs` `clone.ghost`
- `identity.black_silhouette`
- `identity.cape` / size morph
- `identity.text` / UI / third door
- `identity.door_wood` `identity.door_morph` `identity.door_flat` `identity.door_void` `identity.door_chrome` ([DOORS.md](DOORS.md))
- `encode.fade_black` — last frames empty ([HOLD.md](HOLD.md))
- `identity.door_cut` (except last second of **enter**)
- `identity.orbit` (paws sliding down, ceiling falling)
- `lock.lens_mismatch` (atA not the same focal as spawn)

Output: `PASS` or `FAIL identity.face @ t=last`.

Glow in the tap window = later.

**C is required** on stills, walks, breaths. Optional on enter. After A+B PASS, Grok opens `.smoke/MANIFEST.json` and the jpgs. One line per plate. Skip C = do not Hang.

## Where it plugs

```
cook plate
    → smoke (A + B machine, then C vision on extracted frames)
        PASS → write stills/ or films/ → next plate
        FAIL → recook THIS plate (max 2)
                 still FAIL → do not Hang; keep last good / stock
```

atA FAIL does not recook spawn. Walk FAIL does not touch stills.
Enter only enters this pipe if Enter was asked.

`films/` = PASS only. That is "keepers stop being editors".

## What the machine does not do

- It does not improve a clip. No creative crop to hide a muzzle.
- It does not say "almost". Wrong side / face = FAIL.
- It does not launch Hall' to "save" a walk.
- It does not replace the lock.

## Recook cap 2

1. The FAIL line names the file + `rule`.
2. Recook **only that file**.
3. Smoke again.
4. Second FAIL → last PASS encode if any. Breath: freeze still **only if the still PASS `gate.size`**. A punch-in still is **not** a legal gel. Then smoke the loop. Loop FAIL → stock. Gel is decay, not PASS.
5. Never hang a `gate.size punch-in` breath “so the player can see it”. Never a third Imagine cook. Never a sermon in player chat.

A photo loop with no vapor / no chest is a **gel**. Do not call it a living breath. Hard-refresh after a real PASS breath.

### Still = dog size, not just 720×1280

`spawn.jpg --kind still-spawn` used to PASS on file shape alone. `creamHeight` / punch-in lived only in **still-pair** (spawn→atA, walk last). A 0.60 spawn hung in silence until breath compared two frames.

Now the still itself: `creamHeight` → `gate.size punch-in` if h ≥ 0.55, `gate.size spawn-band` if spawn ∉ 0.18–0.36. COOK smokes spawn **before** films. 0.60 dies at the still. 0.19 lives.


Required plates: 3 stills + breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B.
Optional (walk-A-B, walk-B-A, enter): FAIL = recook or drop — do not block the hall.

A+B = `scripts/smoke-pack.mjs` (ffmpeg). C = Grok + `scripts/smoke-identity.md` on `.smoke/` frames. Hang needs both.

Per-clip queue (file → graph → identity): [CLIP.md](CLIP.md).

Gate 2 hash: [PHASH.md](PHASH.md) + [`smoke.json`](smoke.json). Last frame = −40ms. Face is still gate 3.

### Breath Δh / vapor

Breath pair `Δh/H` threshold is **0.11**. If the **only** fail is `gate.size Δh/H` ≤ 0.14 and hall + feet are frozen, Smoke **WARNs** (vapor). Punch-in, yaw, place, hall SSIM still FAIL. A walk on a breath plate is not vapor.

### Walk sprint vs ice (false positive)

`creamPlace` on frost vapor / ice floor can lose Bolt (`h=0`) or snap `cx` to hall center. Next frame he is at teal → `walk_sprint` 0.28. Eyes: he was walking.

Lost dog = drop track, do not use `cx=0.50`. Only consecutive samples (dt ≤ 1.05s) with `h` in 0.16–0.48. Threshold **0.35** W/s (real warp was 0.43). 0.28 after a hole = PASS. Same family as breath vapor.

### Walk yaw vs ice (false positive)

Spawn still **28°** PASS. First frame of the mp4 **37°** FAIL at 32°. Last vs at-A **6°**. Hall first≈spawn **0.998**. Eyes: back. PCA of ice on the encoded jpeg, not a profile.

Walk yaw threshold is **40°**. 37° = PASS. Real turn (44° ¾) still FAIL. Same family as breath vapor / lost ice-dog.
