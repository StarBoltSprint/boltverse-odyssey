# SAS — Smoke is the airlock

Smoke is not a beauty score.  
It is a **lock**: Imagine on one side, `films/` and the player on the other. Nothing crosses without a badge.

Cook is not Keep. FAIL does not Hang. Never a spinner on Bolt. [FAIL.md](FAIL.md) [CLIP.md](CLIP.md)

```
kitchen (Imagine / ffmpeg)
        │
        ▼
   ┌─────────┐
   │  SMOKE  │   PASS badge  or  FAIL stamp + code
   └─────────┘
        │
        ├── PASS → Hang (stills/ or films/) → PACK++
        └── FAIL → recook (≤2) or silent fallback
                   (nothing is written to films/)
```

Two physical doors. Not a “almost.” The gate does not argue. It does not publish.

## What enters

A **plate object**, not a mood.

```
id        walk-spawn-A
kind      still | breath | walk | enter
file      raw path, crop 720×1280 if possible
refs      official spawn / atA / atB + lock examples
attempt   1 | 2
```

Not a whole hall at once. One plate = one pass.  
atA FAIL does **not** open the walk gate (no last refs).

Machine: `node scripts/smoke-pack.mjs <file> --kind walk`  
Pack: `node scripts/smoke-pack.mjs packs/<id>` (stills first).

## Three detectors, short-circuit

1. **Metal** — can it play? size, codec, silence, duration, last frame not black  
2. **Seal** — first/last vs stills ([PHASH.md](PHASH.md)). Graph  
3. **Eye** — 3 frames, list #704. Identity + hall  

Metal no → do not pay for the eye.  
Seal no → may log the eye in debug; verdict is already FAIL.

The gate **returns a stamp**, not an essay:

```
ok: false
rule: graph.last_not_official
at: last
attempt: 2
```

One `rule` = one #704 line become enum.  
Grok / the job reads the enum. The player reads nothing.

## Who may pass

| kind | Minimum badge |
|---|---|
| still-spawn | identity + 2 doors + lock vs example-spawn |
| still-atA/atB | i2i of the **same** spawn, back, 2 doors, hash far enough from spawn (dog really at the sill) |
| breath | first≈last≈still, no step, no dolly |
| walk | first≈start, last≈arrive, first≠last, no Hall′ |
| enter | first≈at-still, last≈fill **same slot**, not spawn′, ≤6–8 s |

The golden pack is the **model passport**. If stock itself fails the seal, the gate is mis-tuned — calibrate, do not “be kind.”

You do not be kind to a side-wolf.

## What the gate refuses

- crop to hide a muzzle
- lengthen dissolve for a drifted last
- let a walk in “to test in play”
- open Hall′ because the walk is pretty
- show the queue on Bolt

A FAIL object has **no public URL**. The player sees it only as a missing edge or as stock.

## Architecture: a service, not a page

- Input: file + kind + refs  
- Output: JSON stamp  
- Allowed side effect: write `smoke.log`  
- Forbidden: write `films/`, bump PACK, talk to the DOM  

Hang is **after** the lock, and only if `ok`.  
The player does not import Smoke. It trusts the folder: what is in `films/` has the badge.

Happy path: the human does not “run Smoke.” The job does, alone.

## Badge states

```
pending   →  plate still in Imagine (player = stock)
pass      →  Hang
fail      →  recook if attempt < 2
reject    →  attempt = 2 : fallback (freeze still / drop edge / stock)
```

`reject` is not a 500. It is a smaller graph. Gate closed for *this* plate, hall still open.

## UX (almost none)

**Player:** zero.  
**Maker debug:** a list `id + rule`.  
**Grok:** “recook walk-spawn-A, last ≠ at-a; do not change spawn.”

No dashboard “73% cinematic.” That is a sermon again.

## Calibration key

[`smoke.json`](smoke.json) next to stock: Hamming thresholds, duration windows. Change rarely, on the golden pack. Never to save a moss plate.

## One line

Smoke is the only door between the dream and the hall. PASS = you are in the pack. FAIL = you do not exist for the tap. The dog is already on the other side, in stock or last good.
