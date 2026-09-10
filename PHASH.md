# PHASH — gate 2 (graph), not identity

Perceptual hash is not a crypto fingerprint. Two photos *a bit* different (compress, 1 breath frame) must be **almost the same** number. Two poses (spawn vs atA) must be **far**.

Smoke uses it at [CLIP.md](CLIP.md) **gate 2**: first/last of the clip ≈ official still?

Machine: `scripts/phash.mjs` + thresholds in [`smoke.json`](smoke.json). Wired in `scripts/smoke-pack.mjs`.

## Algo: pHash DCT

Keep **global shape**, throw noise.

1. Grayscale (biome color must not flip the bit; lock must)
2. Resize **32×32** (not 720×1280 — too much detail = fragile)
3. DCT (JPEG-style) → frequencies
4. Keep the **8×8** low-frequency corner, skip DC (mean brightness)
5. Threshold = median of those 63 values
6. Above median → bit 1
7. Result: **~64 bits**

Distance = Hamming (`popcount(a XOR b)`). 0 = same to the algo. 64 = opposite.

## Thresholds (start — calibrate on golden)

On 64 bits:

| Distance | Read | Smoke |
|---|---|---|
| 0–8 | same photo, encode / a little breath | **≈** OK (breath first=last, walk last vs at-still) |
| 9–16 | same framing, light moved | gray: OK for breath if paws did not move (`dHash`); else WARN |
| 17–32 | other composition | **not** the official still → FAIL graph |
| 33+ | other image | FAIL sure |

Golden check: `stills/spawn.jpg` vs first frame of `breath-spawn.mp4` → **0–8**.  
spawn vs atA → **well above 16** (the dog moved). If that pair is 6, thresholds are dead **or** the stills are too close.

## dHash (breath extra)

9×8, bit = pixel brighter than its right neighbor. Detects a **shift** (dolly: everything slides).

Breath: pHash still low + dHash explodes → `graph.breath_drift` (paws / camera slid, Imagine “loop” walked).

## Pipeline

```
ffmpeg  first.png
ffmpeg  -sseof -0.04  last.png     # not a black end frame
crop 720×1280  THEN  hash
pHash(first) vs pHash(stillStart)
pHash(last)  vs pHash(stillEnd)
pHash(first) vs pHash(last)        # breath: small; walk: large
```

Last frame of an mp4 is often black / incomplete. Take **40 ms before end**. Same crop as the still before hashing.

## What pHash does not see

Face, 2nd dog, thin UI text, teal vs gold if the hall is otherwise identical. That is **gate 3** (vision). pHash = graph. Not identity alone.

## Traps

- Gamma / re-encode: +2…+6 bits, normal
- Imagine loop that shifts 2 px: dHash up, pHash still low → drift if kind=breath
- atA too close to spawn → you cannot tell walk last. Recook stills: the dog must **really** be at the sill
- Magic internet thresholds: calibrate on **stock**, not a paper

## One line

Reduce the picture to 64 bits of global silhouette, count the bits that differ. Close enough to the official still = same graph node. Too far = not that pose. The muzzle is another gate.
