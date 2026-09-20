# 22 — GPU_VER 24 Frost KEEP (neon-safe + contact + ice + plate IBL)

**Audience:** a cold Grok in a new convo. `21-paw-to-galaxy.md` is a **different** law (journey). This file is the **Live compositor KEEP** sealed 2026-09-20 after SmiR phone review (*« Ca te parait bien? »* → KEEP).

Copy [`scripts/bolt-key-gl/bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts) (`GPU_VER = 24`) + [`wet-fx.ts`](../scripts/bolt-key-gl/wet-fx.ts). **FAIL** if you copy `bolt-key-gl-scissor-prev.ts` or hang at GPU_VER 20.

Foundations still apply: [17](17-live-compositor.md) (wire) · [13b](13b-anti-sticker-contact.md) · [16](16-biome-ground-fx.md) · [20](20-default-plate-proportions.md) · [20b](20b-frost-aurora-proportions.md). This law **supersedes** the GPU 17/20 knob table for Frost.

No recook. No new gallop. Hang ≠ wipe.

---

## Why 20 failed on the phone (do not revert)

| Symptom | Cause | Fix (now KEEP) |
|---|---|---|
| Green dash **through** the coat | `mix(c, plate, 0.10)` raw | `bounceSrc` = plate with **neonM chroma-kill** |
| Bolt **blurry** | 5-tap smear `dy=0.0062` on the body | 3-tap `dy=0.0030`, **edge only**, `cSharp = k0.rgb` (straight, never `/ a`) |
| Sticker (studio white) | bounce killed with the neon | bounce **0.42** on `bounceSrc` + edge mix `0.34 * edge²` |
| Hoverboard / skateboard | 1 body ellipse `k` 0.34 + print RGB 0.08 | **2 paw** gaussians, `k` 0.34, print `[0.40, 0.50, 0.48]` |
| Float (no contact FX) | prints too light, `MAX_PRINTS=6`, fade 0.78 | 10 prints α 0.55, 7 ice crystals, fade 0.52 |
| Dry asphalt | no Fresnel | iceMask + grazing + neon streaks + sparkle |
| Studio dog | no sky fill | hemi IBL: sky `plate(0.50,0.78)` + walls ±0.14 |

Premul is **filter space only**. Output is straight `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`.

---

## KEEP knobs (`GPU_VER = 24`)

Frost `uniformsFor`:

```
cool     0.84, 0.93, 1.12
sat      0.54
under    0.70
rim      0.05, 0.10, 0.12     // aurora on the back
print    0.40, 0.50, 0.48     // packed snow, NOT 0.08 / NOT 0.66-invisible
drop     0.48, 0.94, 0.70     // aurora glitter
neon     0.42
snow     0.0                  // snow is baked in the mp4
```

Bolt shader:

```
bounce      0.42 on bounceSrc
interior    mix 0.11 bounceSrc
edge ring   mix 0.34 * edge * edge
smear       3-tap 0.72/0.14/0.14  dy=0.0030  EDGE ONLY
cSharp      k0.rgb straight
grain       (n-0.5)*(0.008 + 0.020*edge)*a
pawHold     alpha * 0.78 on py>0.90   // plate through pads
hemi        mix(fillN, skyN, up*0.62) + sky*up*0.06
sky chroma  0.42   // 1.0 = lime dog
```

Road / contact:

```
CONTACT_K frost     0.34
shadow              TWO paws  rx=0.36*pw  ry=0.20*pw  stance=0.42*(x1-x0)*fit
coolSh              vec3(0.48, 0.56, 0.66)
PAW_PLANT           0.80
PAW_SINK            0.072
reflectK            0.26 grounded / 0 in jump
iceAmb              sky * iceMask * 0.07
```

FX (law 16 row frost):

```
MAX_PRINTS 10   spawn α 0.55/0.36   fade 0.52/s   r = 0.26*pw
MAX_DROPS  28   emit 7 crystals / plant   additive
packP Float32Array(40)    packD Float32Array(112)
```

`canvas key={GPU_VER}`. Bump remounts.

---

## Pass order (do not reorder)

```
1  ROAD_FS     plate + neon dash + Fresnel/streaks/sparkle + skyAmb + dual-paw shadow
2  prints      DST_COLOR multiply   (packed snow occludes the ice reflection)
3  drops       ONE, ONE             (glitter)
4  Bolt mirror uMirror=reflectK     (squashed 0.36, ice tint, fade vUv.y², OFF in jump)
5  Bolt        uMirror=0            straight over
```

---

## Neon-safe bounce (HARD — never raw plate)

```
p0,p1,p2 = plate at vScreen ± 0.018 x
plate    = (p0+p1+p2)/3
neonM    = smoothstep(0.035, 0.14, G-max(R,B))
bounceSrc = mix(plate, vec3(luma), neonM)
bounce    = bounceSrc / max(luma(bounceSrc), 0.07)
c *= mix(1, bounce, 0.42)
c  = mix(c, bounceSrc, 0.11)              // NOT raw plate
c  = mix(c, bounceSrc, 0.34 * edge * edge)
```

**FAIL:** `mix(c, plate, 0.10)` · 5-tap body smear · `cSharp = rgb/a` double unpremul.

---

## Plate IBL (not a .hdr file)

The **live plate frame** is the environment. No rotation, no 32-bit, no GGX mips.

| Lobe | Sample | Where |
|---|---|---|
| Sky | `plate(0.50, 0.78)` aurora | head / back (`up = 1-py`) |
| Fill | `vScreen ± 0.14 x` walls, dash killed | flanks |
| Ground | `bounceSrc` | belly / paws |
| Ice amb | same sky × 0.07 × iceMask | road, **before** shadow |

Chroma clamp 0.42. Too high = green dog.

HDRI words we do **not** implement: env rotation, 32-bit exposure, roughness mips, separate background.

---

## Ice reflections (ROAD_FS)

`uSnow` stays **0** (thin snow is baked; a second mix milks the asphalt).

```
iceMask  = road trapezoid, cut sky y>0.46
grazing  = exp(-y * 2.6)          // more spec toward camera
aurora   += vec3(0.10,0.40,0.20) * grazing * 0.30
spec     += pow(luma, 5.5) * 0.22
streaks  4 taps toward camera on baked dashes
sparkle  hash(road.rgb) so it scrolls with the plate — never gl_FragCoord-only
```

Bolt puddle: second draw, Y-flip, `a *= reflectK * vUv.y²`. Must not read as a second dog.

---

## Smoke (phone)

| Check | PASS | FAIL |
|---|---|---|
| Neon | dash **under** Bolt | green stripe **in** the torso |
| Interior | sharp gallop | body blur / sticker halo |
| Contact | two paw marks, packed-snow prints | hoverboard rectangle / nothing |
| Ice | lower road wet + streaks | milky blanket / dry asphalt |
| IBL | back slightly cyan from aurora | lime coat / studio white |
| Mirror | faint, gone in jump | second dog |
| Scale | withersFrac ~0.10 | grow to 0.22 on the wide road |

Related: [17](17-live-compositor.md) · [13b](13b-anti-sticker-contact.md) · [16](16-biome-ground-fx.md) · [20b](20b-frost-aurora-proportions.md) · [00](00-PRIORITY0-any-biome.md) · paste [COLD_START-gpu24.md](COLD_START-gpu24.md) · [WIRE](../scripts/bolt-key-gl/WIRE.md)
