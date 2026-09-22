# 13b — Anti-sticker + contact shadow

HARD LOCK companion to `13-make-bolt-lane.md`.  
Bolt stays a **cutout**. Fix the **seam**, do not bake him into the mp4.

Companion: `10-bolt-cutout-law.md`, `12-lane-path-ribbon.md`, `13-make-bolt-lane.md`, [13d-auto-scale.md](13d-auto-scale.md) (`computeScale` / `assertScale`), [14c-gallop-clock.md](14c-gallop-clock.md) (`assertGallopClock`), [16-biome-ground-fx.md](16-biome-ground-fx.md) (biome-adaptive prints / splash / dust — GPU family, law 15) · [17-live-compositor.md](17-live-compositor.md) (Live GPU: plate bounce, luma protect, sin grain) · **[22-gpu24-frost-keep.md](22-gpu24-frost-keep.md) (GPU_VER 24: neon-safe bounce, dual-paw, ice Fresnel, plate IBL)**.  (`21-paw-to-galaxy.md` is a different law.) 
After key, despill before grade (`13c-green-despill.md`). After despill, MUST run `computeScale` / `assertScale` ([13d](13d-auto-scale.md) + [`biome/scripts/bolt-scale/`](../scripts/bolt-scale/)) then `gallop-clock` / `assertGallopClock` ([14c](14c-gallop-clock.md) + [`biome/scripts/gallop-clock/`](../scripts/gallop-clock/)) before KEEP. Ground FX row for **this** `{PAINT}`: [16](16-biome-ground-fx.md). Any-biome cook: [00-PRIORITY0-any-biome.md](00-PRIORITY0-any-biome.md).

**Live compositor (law 17 + **22**) — HARD.** Sticker is killed in the GPU shader, not by baking Bolt into the road mp4. After key: sample the road **neighborhood** behind the dog (`uPlate` / `vScreen` ±0.018), **chroma-kill neon** (`bounceSrc`), then `c *= mix(1, bounce, 0.42); mix(c, bounceSrc, 0.11)`. **Never** `mix(c, plate, 0.10)` raw (green dash through the coat). Edge `smoothstep(0.05, 0.80, a)`, 3-tap smear **edge only** (`dy=0.0030`, `cSharp = k0.rgb` straight). Grain = `fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453)` — **FAIL** = IGN `fract(dot)` (vertical bars). Luma protect `<0.14` keeps dark paws. Paw hold `py>0.90` α×0.78 (plate through pads) — **not** a fade-to-zero. Contact shadow is **two paw gaussians on the road**. Copy [`bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts) (`GPU_VER = 24`) + [`wet-fx.ts`](../scripts/bolt-key-gl/wet-fx.ts). **FAIL** if Grok copies `bolt-key-gl-scissor-prev.ts`. Law: [17](17-live-compositor.md) · [22](22-gpu24-frost-keep.md).

**PRIORITY 0 COMPOSITE GATE** — when compositing the **sealed** cycle (`lock/bolt-gallop-cycle.mp4` keyed onto Video A), **light + contact are HARD — not optional polish.** Before KEEP / Hang: grade the cutout from **this** empty plate family + small paw contact shadow multiply on the *road*. Missing either = **FAIL** (warm/neutral sticker on frost / dog floats). Scale = [13](13-make-bolt-lane.md) + [13d](13d-auto-scale.md) (lane-width fill = FAIL; Grok must not pick size by eye). After scale, MUST `gallop-clock` / `assertGallopClock` ([14c](14c-gallop-clock.md)). Order: key → despill (`13c`) → **`computeScale` / `assertScale`** (`13d`) → **`gallop-clock` / `assertGallopClock`** (`14c`) → plate grade → contact → **ground FX row (16)** → shared grain. **FAIL** if Grok keys the cycle and hangs without scale + gallop-clock + light + contact + FX-row proof.

## What makes him look like a sticker

- Knife-sharp alpha, no ground contact  
- One lighting key on every biome  
- Gallop that does not share the plate’s shutter / grain  
- Shadow missing, or a perfect oval that ignores the road  
- Scale that never changes when the road recedes  
- Rim that does not match the plate sun  
- Dissolve that pops the outline  
- Cutout that ignores THIS plate’s light (studio grade, bounce missing)  
- IGN `fract(dot)` grain (vertical bars)  
- Sprite bottom fade that eats hind paws  

Fix those and he stays steerable *and* reads as in the shot.

## Stack (compositor, not Imagine)

```text
plate (empty road + glow)
  + cutout (paws on P(s,λ), graded, grain ring)
  + contact shadow          ← this doc
  + holdout where world is in front
  + one shared grain pass
```

**Do not** solve “sticker” with three Imagine dogs (L/M/R). That integrates for one second and kills steer.

---

## A. Contact, not outline (PRIORITY 0 — HARD)

Missing paw contact = float = **FAIL**. Not polish. Not a later pass.

Anchor at the **paws**. Ribbon point \(P(s,\lambda)\) is dirt, not chest.

- Small **contact shadow** under paws only (see §C).  
- 2–4 px **holdout** where paws meet road: plate dust/grain shows through the lowest ~5% of the legs. That leak kills the paper-doll read.  
- Never a full-body drop shadow from a PNG.  
- Rock / lightning in front = separate plate holdout matte, not a thicker sprite.

## B. Light, edge, time, scale

### Light from the plate (PRIORITY 0 — HARD)

Do not ship one lit green-screen turnaround forever. Grade the cutout **FROM** the empty plate family (rim from plate sun side, frost desat/cool, ember warm, darker under-legs). Warm/neutral cutout on a cold frost plate = **FAIL**. Grade **per plate family** with three knobs only:

- lift / gamma toward plate mid  
- rim from the same side as the plate’s brightest edge  
- saturation clamped to biome (ember warm, frost pulled)

Bake as a 3-parameter LUT per catalog paint — not a new Imagine dog. Optional cheat: sample 3 plate pixels (shoulder-L, shoulder-R, zenith) and soft-multiply. Further = Citadel relight, not Lane.

**Plate bounce (Live, law 17 + **22**) — HARD, not optional cheat.** Sample the road behind the dog every frame. **Do not mix raw plate** (neon dash under the torso = green through the coat). GPU_VER 24:

```
p0,p1,p2 = plate at vScreen ± 0.018 x
plate = (p0+p1+p2)/3
neonM = smoothstep(0.035, 0.14, G-max(R,B))
bounceSrc = mix(plate, vec3(luma), neonM)
bounce = bounceSrc / max(luma(bounceSrc), 0.07)
c *= mix(vec3(1.0), bounce, 0.42)
c  = mix(c, bounceSrc, 0.11)                 // NOT raw plate
c  = mix(c, bounceSrc, 0.34 * edge * edge)
hemi IBL: sky plate(0.50,0.78) + walls ±0.14, chroma 0.42
3 vertical taps, dy=0.0030, 0.72/0.14/0.14, INTERIOR SHARP (cSharp = k0.rgb straight)
```

**FAIL:** `mix(c, plate, 0.10)` raw · 5-tap body smear (`dy=0.0062`) · `cSharp = k0.rgb / k0.a` (double unpremul) · one body-ellipse shadow. Premul is **filter space only**; Bolt over-composite is straight `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`. Law: [22](22-gpu24-frost-keep.md).

`uniformsFor(chap)` only tints after bounce (frost ≠ ember). A 3-parameter LUT without sampling THIS plate still reads sticker. Code: [`bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts).

### Edge that belongs to the film

Sticker edge = binary alpha. Film edge = dirty.

- Dilate alpha 1 px, erode 1 px, then **multiply by plate grain** on a 2 px ring.  
- Hair of chromatic fringe if the plate has it.  
- Never unsharp-mask the outline. Soft plate → soft cutout.

### Time lock

- Gallop frame = \(f(\text{plate time})\), not an independent clock.  
- When \(m\) leads \(s\) a little: longer strides in place (slide paws along \(s\)), do **not** speed the cycle past the plate.  
- One grain pass covering plate + cutout (composite before grain, or match mild grain).

### Scale and lean

Base scale is HARD ([13](13-make-bolt-lane.md) / [13d](13d-auto-scale.md)): withers ~0.22–0.32 of frame; paws lower third; Bolt must **NOT** fill lane width. `computeScale` / `assertScale` from the road — Grok must not pick size by eye. Fixed “0.28 of frame” is a sticker if the road is a vanishing trench — then:

\[
\text{scale} \propto \frac{w(s)}{w_{\mathrm{ref}}}
\quad\text{clamped ~0.85–1.15}
\]

Yaw = path tangent. A few degrees of lean into \(\lambda\times\kappa\) on hooks. Zero lean = fridge magnet.

### Coat across biomes

One master sheet, **two grades**, not two models. Low specular. Darker under-legs. Mid-white + grade > clipped hero-white. Optional: slow breath/ear loop (1–2 fps) on top of gallop — dead ears on a moving plate = sticker.

### One-evening A/B

Same plate, same PNG:

- **A:** hard alpha, no shadow, free walk cycle  
- **B:** paw anchor, 2 px grain ring, contact multiply, plate-sampled rim, scale from \(w\), cycle locked  

If B still reads sticker, plate contrast is wrong — recook the *road*, do not redraw the breed.

**Rule:** the film must dirty him. He must not stay cleaner than the world he runs on.

---

## C. Contact shadow generator

A contact shadow is **not** a character drop-shadow. It is a dirty patch on the road where the paws claim the ground. Generate from the ribbon + sprite facts. **Do not** paint it into the plate.

### What it knows

- Ribbon: \(P(s,\lambda)\), \(N\), \(T\)  
- Road half-width \(w\)  
- Gallop phase (optional \(m\))

If it follows the whole-dog silhouette → sticker shadow. If it ignores road direction in screen space → slides.

### Minimal generator (Lane-good)

Gaussian in ribbon coordinates, warp to plate.

\[
A(s',\lambda')
=
\exp\!\Big(
-\frac{(s'-s)^2}{2\sigma_s^2}
-\frac{(\lambda'-\lambda)^2}{2\sigma_\lambda^2}
\Big)
\]

- \(\sigma_s\) ≈ paw length in \(s\) (≈0.01–0.02 of plate)  
- \(\sigma_\lambda\) narrower than a lane  

\[
\mathrm{uv}=C(s')+\lambda'\,w(s')\,N(s')
\]

Draw \(A\) into a small buffer (64×32 enough). **Multiply** plate (only plate) by \(1-kA\). \(k\) ≈ 0.25–0.45. Full black = hole.

This beats an oval under the sprite because the blob **bends with \(C\)** on hooks.

### Contact, not puddle

| Driver | Effect |
|---|---|
| Gallop phase | Stronger on down-stride; almost gone airborne. Two peaks/cycle if front/hind known. |
| \(w(s)\) | Tighter road → smaller, darker. |
| \(m\) | Slightly longer \(\sigma_s\) when committed. |
| Plate luma under paws | Darker plate → *less* extra multiply (don’t crush a black rut). |

Airborne: dip \(k\) to ~0.15, not zero (zero pop is worse).

### Screen-space cheap variant

No ribbon atlas? Anisotropic blob at paw UV: major = \(T\), minor = \(N\), aspect ≈ 2.5:1, size ∝ \(w\). Same multiply. Hooks slightly wrong; fine for night one.

### Do not use as contact

- Whole-body projected shadow from a fake key (fights plate sun)  
- SSAO cutout-vs-plate (plate has no depth; will AO glow/lightning)  
- Baked shadow in Imagine (\(\lambda\) moves, stain stays)  
- Ray-traced 3D Bolt contact (Citadel OK; wrong for Lane latency)

### Edge and grain

- Blur \(A\) more than the sprite edge (2–3 px at 1080).  
- Multiply **before** shared grain so grain lives in the shadow.  
- Never put the shadow in the cutout premultiply — it sits on the *road* so holdouts can cover dog + stain.

### Two paws vs one blob

One blob at stance midpoint is fine at Lane scale. If large: front \(s+\delta\), hind \(s-\delta\), alternate \(k\) with phase. Two stamps, one shader. Do not outline each pad.

### Tiny recipe

```text
q = inverseRibbon(uv)                 // (s', λ') or miss
if miss: factor = 1
else:
  ds = wrapArc(q.s - paw.s)
  dl = q.λ - paw.λ
  A  = exp(-0.5 * (ds/σs)^2 - 0.5 * (dl/σλ)^2)
  A *= gallopContact(phase) * k
  A *= soft(plateLuma)
  factor = 1 - A
plate *= factor
```

Reuse `inverseRibbon` from glow hit-tests.

### Still fake when

- Blob center = chest → hovers  
- \(\sigma_s\) too long → skid mark  
- \(k\) too high on frost with **one** ellipse → hole / hoverboard. KEEP frost `CONTACT_K=0.34` as **two paw** gaussians, `rx=0.36*pw` `ry=0.20*pw` (one oval `ry=0.38` = skateboard)
- Prints multiply RGB < 0.3 on frost → black board sliding under paws. KEEP print `[0.40, 0.50, 0.48]` α 0.55 (0.66 α 0.32 = invisible)
- 5-tap smear on the whole sprite → Bolt looks out of focus. Interior must stay sharp ([22](22-gpu24-frost-keep.md))  
- Shadow on top of cutout → sticker outline (under, always)  
- Fixed pixel size while \(w\) changes → wrong weight vs distance  

**Rule:** contact = function on the ribbon, multiplied into the plate, softer than the dog, timed to the stride.

Sealed 2026-09-20 — anti-sticker + contact shadow + Live plate bounce (law 17).
GPU_VER 24 — neon-safe bounce + dual-paw contact + ice Fresnel + plate IBL ([22](22-gpu24-frost-keep.md)).
Keyed Howl obstacles and shatter plates use this same stack (quad, bounce, contact). The Howl ring plate does not ([32](32-howl-gpu-targets.md)).
