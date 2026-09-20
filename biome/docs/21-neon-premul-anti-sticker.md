# 21 — Neon-safe bounce, contact, premul, anti-sticker (GPU_VER 20)

**Audience:** a cold Grok in a new Build convo. Phone said *« Bolt est beaucoup mieux »* then *« pk bolt est flou »*. This file is why. Copy [`bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts) **as-is**. Do not invent a 5-tap body blur. Do not mix raw neon plate into the coat.

**Sealed 2026-09-20 (SmiR phone: Recording 21:27 PASS anti-sticker, Recording 21:32 FAIL body-blur).** Hang ≠ wipe. Companion: [17](17-live-compositor.md) · [13b](13b-anti-sticker-contact.md) · [20](20-default-plate-proportions.md) · [20b](20b-frost-aurora-proportions.md).

`GPU_VER = 20`. Bump + remount (`key={GPU_VER}`) after any shader edit.

---

## A. What the phone showed (do not “fix by eye”)

| Symptom | Cause | FAIL if you |
|---|---|---|
| Green neon **through** Bolt’s torso / legs | `mix(c, plate, 0.10)` sampled the **dash** under the dog. Bounce `plate/luma` amplified G. | mix **raw** plate into the coat |
| Hoverboard / dark skateboard under paws | Wet prints multiply `~0.08,0.12,0.16` + fat contact ellipse `ry=0.38*pw` `k=0.34` | dark prints, fat black oval |
| Paws “don’t touch” | Contact too dark **looks** like a board; plant was OK (`PAW_PLANT=0.80` + `PAW_SINK=0.072`) | grow Bolt / recook gait |
| Sticker (studio-white coat) | Killing neon by dropping bounce to 0.28 *and* interior mix 0 | skip bounce |
| Bolt **blurry** | 5-tap smear `dy=0.0062` on the **whole** body to match plate shutter | smear the interior |

Anti-sticker is **light from THIS plate**. It is **not** a defocus of the dog.

---

## B. Neon-safe bounce (HARD)

Law 17 said:

```
bounce = plateRGB / max(plateLuma, 0.07)
c *= mix(1, bounce, 0.32)
c  = mix(c, plate, 0.10)
```

That **leaks the dash**. On a neon highway the texel behind the dog is often `#2EFF7A`. Mixing 10 % of that = green stripe through the coat.

**KEEP (GPU_VER 20):**

```
// 3-tap neighborhood so a dash under the spine does not own bounce
p0 = plate(vScreen)
p1 = plate(vScreen + (0.018, 0))
p2 = plate(vScreen - (0.018, 0))
plate = (p0+p1+p2)/3

pG    = plate.g - max(plate.r, plate.b)
neonM = smoothstep(0.035, 0.14, pG)
bounceSrc = mix(plate, vec3(pLuma), neonM)   // kill chroma, keep luma
bounce    = bounceSrc / max(luma(bounceSrc), 0.07)

c *= mix(1, bounce, 0.36)          // asphalt light, not dash
c  = mix(c, bounceSrc, 0.09)       // interior from ROAD albedo
c  = mix(c, bounceSrc, 0.22*edge*edge)  // edge only
```

**Ban:** `mix(c, plate, 0.10)` with raw plate.  
**Ban:** bounce 0 (sticker).  
**Ban:** bounce from a single texel on a neon line.

Frost sat **0.56** (0.76 = studio). Rim `* 0.55` on the back. Under-legs `uUnder=0.74`.

---

## C. Smear = edge only (HARD)

`sampleKey` returns **straight** RGB (fur color) + coverage `a`. Not premul.

**KEEP:**

```
dy = (0, 0.0030)                 // ~2 px, fringe only
premul = k0.rgb*k0.a*0.72 + k1*0.14 + k2*0.14
aAvg   = k0.a*0.72 + …
c      = premul / max(aAvg, 0.001)   // unpremul after filter
cSharp = k0.rgb                      // STRAIGHT — do NOT / a
edge   = 1.0 - a
c      = mix(cSharp, c, 0.18 + 0.72*edge)

a = mix(aAvg, min(k0,k1,k2,aL,aR), 0.32)   // mild erode
a = smoothstep(0.05, 0.80, a)               // dirty edge, not knife
```

| | PASS | FAIL |
|---|---|---|
| Interior | `cSharp = k0.rgb` (net galop) | 5-tap 0.36/0.22/0.22/0.10/0.10 |
| `dy` | 0.0030 | 0.0062 |
| `cSharp` | `k0.rgb` | `k0.rgb / k0.a` (double unpremul → blown edges) |
| Erode | 0.32 | 0.58 (knife) |

The 5-tap was a **correct** premul filter that was simply **too wide**. Premul did not cause the blur. Kernel size did.

---

## D. Premultiplied alpha (do not mix conventions)

Two encodings:

| | Straight (what `sampleKey` returns) | Premul (filter space) |
|---|---|---|
| Opaque white | `(1,1,1,1)` | `(1,1,1,1)` |
| 50 % white | `(1,1,1,0.5)` | `(0.5,0.5,0.5,0.5)` |
| Keyed-out | `(?, ?, ?, 0)` RGB poubelle (often leftover green) | `(0,0,0,0)` |

**Filter / smear / mipmap MUST be premul.** Average straight RGB of white fur + keyed green = **green halo**. Average `rgb*a` then divide by `aAvg` = clean white.

**Composite Bolt over plate is straight “over”:**

```
gl.blendFunc(SRC_ALPHA, ONE_MINUS_SRC_ALPHA)
gl_FragColor = vec4(c, a)     // c is STRAIGHT
// GPU: c*a + plate*(1-a)
```

If `c` were already premul with this blend → Bolt too dark, black fringe.  
If you unpremul twice (`cSharp = k0.rgb / k0.a`) → edges ×5, blown coat.

Canvas `premultipliedAlpha: true` + `alpha: false` → the page has no canvas alpha. The **real** contract is `blendFunc` + what you put in `gl_FragColor`.

Prints use **premul** `vec4(uCol * a, a)` + `DST_COLOR, ONE_MINUS_SRC_ALPHA` (multiply). Drops: `ONE, ONE` (additive). Do not copy those blends onto Bolt.

---

## E. Contact + prints (no hoverboard)

Contact lives **on the road** (pass 1 multiply), not a sprite fade.

```
PAW_PLANT = 0.80
PAW_SINK  = 0.072          // GPU edge-soft eats tips
CONTACT_K frost = 0.20     // bright snow; 0.34 punched a box
shadow.rx = pw * 0.82
shadow.ry = pw * 0.24      // NOT 0.38 (skateboard oval)
shadow.k  = clamp(k, 0.10, 0.22)
```

Prints (frost): multiply colour **`[0.66, 0.74, 0.70]`**, spawn alpha ~0.35.  
**FAIL:** `[0.08, 0.12, 0.16]` — that is a black board sliding under the paws.

Ban: `py>0.90` fade on the sprite (eats hind legs). Ban: whole-body drop shadow.

---

## F. Frost knobs (GPU_VER 20) — start here, then `{PAINT}`

```
cool   0.84, 0.93, 1.12
sat    0.56
under  0.74
rim    0.04, 0.055, 0.08     // * 0.55 in shader
bounce 0.36 on bounceSrc     // neon-stripped
mix    0.09 bounceSrc interior
CONTACT_K 0.20
print  0.66, 0.74, 0.70
drop   0.72, 0.88, 0.82
grade  0.10
neon   0.42                  // road bloom on dashes (ROAD_FS)
snow   0.0                   // snow already in the plate — do not double-wash
```

Road shader may bloom green dashes (`uNeon`) **on the plate**. Bolt bounce must **not** pick that bloom back up (neonM). `uSnow=0` when the mp4 already has thin powder.

Clock unchanged: 96 fps / 534 / `STRIDE_HZ=4` / `playbackRate=1`. Scale 13d **as-is** (withersFrac ~0.10 KEEP on a wide law-20 road).

---

## G. Ordered fix when the phone says “sticker / blur / neon through / hover”

1. Confirm `GPU_VER` remounted. Hard refresh.
2. Neon through body → neonM + `bounceSrc`, never raw plate mix.
3. Hoverboard → lighten prints + flatten `ry` + cap `k` 0.22.
4. Sticker (white studio) → bounce **0.36**, sat **0.56**, dirty edge. Do **not** 5-tap the body.
5. Blur → interior `cSharp`, `dy=0.0030`, 3-tap 0.72/0.14/0.14.
6. Double-unpremul blown edges → `cSharp = k0.rgb` not `/ a`.

**FAIL** if: invent a new gallop · bake Bolt into the plate · SPH / Box2D · copy `bolt-key-gl-scissor-prev.ts` · IGN `fract(dot)` grain · 5-tap body smear · `mix(c, plate)` raw neon · print RGB < 0.3 on frost · grow Bolt to fake withersMin.

Related: [17](17-live-compositor.md) · [13b](13b-anti-sticker-contact.md) · [13c](13c-green-despill.md) · [15](15-gpu-compositor.md) · [16](16-biome-ground-fx.md) · [20](20-default-plate-proportions.md) · [WIRE](../scripts/bolt-key-gl/WIRE.md)
