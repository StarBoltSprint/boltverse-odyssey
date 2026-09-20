# 14b — One stride → loop → ribbon (live shoot *or* Imagine)

HARD LOCK companion to `14-rotary-gallop.md`.  
**One clean rotary stride**, not a long shot to stitch. Same mechanics whether the source is a real dog or Imagine.

Companion: `10-bolt-cutout-law.md`, `13` / `13b` / `13c`, `12` + `curvature-sample`.

---

## Shared product (both paths)

```text
phase = (plate_time * 4) % 1          // ~4 strides/s
frame = floor(phase * n)
pos   = ribbonPoint(table, s, λ)
rot   = tangent + lean(λ, κ)          // tiny; see 14
scale = w(s) / w_ref
shadow = contact(s, λ, phase)         // k low on flights
```

- \(m\) advances \(s\), **not** `strideHz`  
- Pivot = **paws**, not nose  
- One geometry strip; biome grades later  
- Ping-pong forbidden (breaks rotary)  
- Empty road = plate **A**. Gallop loop = cutout **B**. Never bake B into A  

---

## Path A — Live dog (optional)

### Set

- Camera **fully locked** (head, zoom, focus). Height like the plate: behind shoulder, slightly above withers.  
- 60–120 fps if possible; ~180° shutter; fixed lens. No punch-in.  
- Even green/chartreuse behind the dog; separate cyc light; flag rim spill.  
- Soft banal dog light (thrown away in plate grade).  
- Treadmill: matte black mat preferred (key background only; scrape paw bottoms in comp). Green under pads = hell.  
- Short runway: 6–8 m green, straight line, camera on axis.  
- No collar / leash / green crew in frame. White coat → despill, not a harder key.

### What to capture

One **readable rotary** stride: gathered flight + stretched flight + offset supports (not a bound). 8–12 passes; keep 3 where the back truly opens. If he trots, unusable.

### Cut the stride

Mark trailing-hind plant **A** → same pose next stride **A′**. Export PNG / ProRes 4444 **straight** (not premul), green margin left for key.

Natural stride ≈ 0.22–0.28 s → target **0.25 s** (4 Hz). Optical flow only inside an already-correct pose — do not invent stretched flight from a trot. No per-plate or \(m\)-linked warp.

Then: key → measure \(\mathbf{s},\mathbf{n}\) → vector despill (`13c`) → premul → 1 px coverage blur → pack strip + JSON `{ fps, n, pivot, strideHz: 4 }`.

---

## Path B — Imagine (default for Tide / Odyssey)

This is the **B → cycle → green → key** factory. Same mechanical checklist as live; different generator.

### PRIORITY 0

Show `lock/bolt-back.jpg` in Build chat before any Bolt cook. No other identity teacher.

### Cook order

1. **Still** — strict rear (or law-locked angle), full-white GSD, yellow bolt mark, paws readable. Flat `#00FF00` if this still feeds the green loop.  
2. **Video B / gait** — `imagineBoltClip` / hooks with **first + last** = one in-place rotary stride. Start already in sprint. Hind legs fully back in the stretch. 100% rear every frame when law says so. Distinct last frame. Locked camera. Décor optional only as gait reference then discarded — **final cutout is green**.  
3. **Pick cycle** — extract best gathered + stretched pair; reject collected/skate / ¾ / face-on.  
4. **Green repose** — re-pose cycle on flat green if B was on décor.  
5. **Key + despill** — `13c` (renderer alpha preferred when available).  
6. **Pack** — same strip + pivot + `strideHz: 4` as live.  
7. **Plate A** — empty road separately (`imagineBiomeClip`); author `path.json` (`12` / `resamplePath`). Hang ≠ wipe.

### Imagine rails (FAIL if broken)

| Rail | FAIL |
|---|---|
| Teacher gate | Cook without showing `lock/bolt-back.jpg` |
| Identity | Grey/black coat, morph across frames |
| Camera | Orbit / face-on spawn / ¾ sold as rear |
| Gait | Trot, skate, no stretched flight, four paws under belly |
| Layers | Dog painted into road plate; 3-take L/M/R as “control” |
| Time | Chat Imagine without first/last hooks; strideHz driven by \(m\) |
| Hang | Wipe `biome/master/*` for a new biome |

Verbatim prompts live under `biome/prompts/` (`image-bolt-mid.txt`, `video-bolt-mid.txt`, empty plate). Prefer hooks over chat Imagine UI.

### Time-warp (Imagine)

Same 0.25 s target. If the cooked clip is longer, retime **after** you have a true rotary cycle — never to fake aggressiveness. \(N/\mathrm{fps}=0.25\).

---

## On the ribbon (both paths)

```text
phase = (plate_time * strideHz) % 1
s    += ds_plate + k_m * m
λ    += ease(λ_target)              // one window tap; see 14 turn
pos   = ribbonPoint(table, s, λ)
```

Contact shadow under paws, \(k\) from phase (`13b`). Grade per biome after geometry is sealed. Shared grain last.

## Packing

- Anchor = mid stance supports, not nose  
- Same crop every loop frame  
- `bolt_gallop.png` (or webm) + `{ fps, n, pivot: [x,y], strideHz: 4 }`  
- Two grades later (ember / frost), **one** geometry  

## Breaks if

- Camera chased the dog (scale breathes in the loop)  
- Only one suspension  
- Loop on a blink / ear flick  
- Time-warp ×2 for “more aggressive”  
- Green under pads with no holdout  
- Three Imagine dogs instead of this loop  
- Gallop invented inside the road mp4  

**One stride, 4 Hz, despill, paw pivot, \(P(s,\lambda)\).** Everything else is grade.

Sealed 2026-09-20 — live or Imagine stride factory.
