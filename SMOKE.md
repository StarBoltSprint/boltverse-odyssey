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

Rules: `graph.first_eq_last` `graph.first_not_official` `graph.last_not_official` `graph.last_is_dest_spawn` `clone.two_dogs`

Drift of last frame → `graph.last_not_official`. Dissolve does not fix it.

### C. Identity + hall (vision, 3 frames)

Video: t = 0, mid, last (script writes `.smoke/<clip>/{first,mid,last}.jpg`). Still: the photo.

Grok vision. Prompt: [scripts/smoke-identity.md](scripts/smoke-identity.md). You are not kind to a profile wolf.

Hard FAIL, one rule code, no paragraph:

- `identity.face` `identity.muzzle` `identity.look` `identity.profile` `identity.three_quarter`
- `clone.two_dogs` `clone.ghost`
- `identity.black_silhouette`
- `identity.cape` / size morph
- `identity.text` / UI / third door
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
4. Second FAIL → last PASS encode if any; else freeze still for breath, drop optional walk/enter.
5. Never a third Imagine cook. Never a sermon in player chat.

Required plates: 3 stills + breath-spawn, breath-A, breath-B, walk-spawn-A, walk-spawn-B.
Optional (walk-A-B, walk-B-A, enter): FAIL = recook or drop — do not block the hall.

A+B = `scripts/smoke-pack.mjs` (ffmpeg). C = Grok + `scripts/smoke-identity.md` on `.smoke/` frames. Hang needs both.
