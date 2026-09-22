# 17 — Live compositor (what actually stuck Bolt to the plate)

**Audience:** a cold Grok porting [`bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts) into Live.  
**This is the Frost-parity recipe.** The old scissor / IGN-fract file is **ARCHIVE** (`bolt-key-gl-scissor-prev.ts`). Copying it = **FAIL** (vertical bars + eaten hind legs + sticker).

Sealed 2026-09-20 after Frost Live. Hang ≠ wipe.

**GPU_VER 24 (law 22) supersedes the raw `mix(c, plate, 0.10)` bounce.** Neon dashes through the coat, hoverboard prints, and 5-tap body-blur are **FAIL**. Read [22-gpu24-frost-keep.md](22-gpu24-frost-keep.md) **before** retuning bounce / smear / prints. `21-paw-to-galaxy.md` is a different law.

---

## Do not copy the sketch

| Sketch (FAIL) | Live (PASS) |
|---|---|
| `scissor` + fullscreen Bolt sample | **Quad** at dest 13d (`uRect` NDC) |
| `smoothstep(0.14, 0.018)` only | hard 0.157/0.063 + **luma protect < 0.14** |
| `fract(dot)` IGN grain | `fract(sin(dot(...)*43758.54))` |
| Frost grade **baked** in shader | `uCool/uSat/uUnder/uRim` from **this** `{PAINT}` + **plate bounce** |
| `currentTime` seek / upload every rAF | native `loop=1×` + **rVFC stamp** (not harvest 534 canvases) |
| no FX | mark **quads** + Euler `wet-fx.ts` |
| no remount | `GPU_VER` + `key={GPU_VER}` on canvas |
| `mix(c, plate, 0.10)` raw | **neon-stripped** `bounceSrc` (law 22) |
| 5-tap body smear | interior sharp + edge 3-tap (law 22) |

Ban: fade `py>0.90` to zero on the sprite (eats paws). KEEP pawHold α×0.78. Contact shadow is **two paws on the road**, not a sprite fade.  
Ban: SPH / Box2D / general physics engine.  
Ban: baking Bolt into the road mp4.  
Ban: `cSharp = k0.rgb / k0.a` (double unpremul). `sampleKey` is **straight**.

---

## Stack (GPU family, law 15)

```
pass 1  road fullscreen  + dual-paw contact + ice Fresnel/streaks/sparkle + sin grain
        frost: uNeon bloom on dashes (ROAD_FS). uSnow=0 if snow is in the mp4.
pass FX prints (DST_COLOR, 10) + drops (additive, 28) as tiny quads
pass 2  Bolt mirror (uMirror=reflectK, OFF in jump) then Bolt quad:
        key + despill + sat/cool
        + neon-safe plate bounce (3-tap neighborhood, chroma kill)
        + hemi IBL sky(0.50,0.78)+walls ±0.14
        + 3-tap smear EDGE ONLY + dirty smoothstep
```

`makeCompositor(canvas)` **before** `getContext("2d")`.  
`preserveDrawingBuffer: false`. `premultipliedAlpha: true`.  
Bolt blend = `SRC_ALPHA, ONE_MINUS_SRC_ALPHA` (straight over).  
Road upload gated ×48. Bolt upload on **new rVFC mediaTime** (or currentTime if no rVFC). After first alloc: `texSubImage2D`.

Paw/stance scan **once** at boot (13d) on a standing frame — not 60×/s.

---

## Key (do not retune by eye)

```
greenness = G - max(R,B)
hard = G>0.157 && greenness>0.063
soft = G>0.118 && smoothstep(0.016, 0.063, greenness)
protect = luma<0.14 && greenness<0.12     // dark paws
alpha = max(1 - mix(soft,1,hard), protect)
despill: G → max(R,B) ; leftover G * 0.85
```

Then `a = mix(aAvg, erode, 0.32)` + `smoothstep(0.05, 0.80, a)` — dirty edge, not knife.

---

## Anti-sticker = light from THIS plate (HARD) — law 22

After key. **Do not** mix raw plate (neon dash under the dog = green through the coat).

```
p0,p1,p2 = plate at vScreen and ±0.018 x
plate = (p0+p1+p2)/3
neonM = smoothstep(0.035, 0.14, G - max(R,B))
bounceSrc = mix(plate, vec3(luma), neonM)
bounce = bounceSrc / max(luma(bounceSrc), 0.07)
c *= mix(1, bounce, 0.42)
c  = mix(c, bounceSrc, 0.11)              // interior = road albedo, not dash
c  = mix(c, bounceSrc, 0.34 * edge * edge)
hemi IBL: sky plate(0.50,0.78) + walls ±0.14, chroma 0.42
```

Smear is **edge only** (interior stays the 96 fps gallop):

```
dy = 0.0030
premul = k0.rgb*k0.a*0.72 + k1*0.14 + k2*0.14   // filter in premul
c      = premul / max(aAvg, 0.001)              // unpremul
cSharp = k0.rgb                                 // STRAIGHT — never / a
c      = mix(cSharp, c, 0.18 + 0.72*edge)
```

**FAIL:** 5-tap `dy=0.0062` on the whole body (phone: *« pk bolt est flou »*).  
**FAIL:** `mix(c, plate, 0.10)` with raw plate.  
**FAIL:** one body-ellipse shadow (hoverboard).  
Full KEEP table: [22](22-gpu24-frost-keep.md).

Biome knobs (`uniformsFor(chap)`):

| `{PAINT}` | cool | sat | under | rim |
|---|---|---|---|---|
| frost / ice / crystal | 0.84, 0.93, 1.12 | **0.54** | 0.70 | 0.05, 0.10, 0.12 |
| tide / wet | 0.82, 0.95, 1.08 | 0.62 | 0.76 | 0.05, 0.09, 0.12 |
| night | 0.78, 0.84, 1.14 | 0.68 | 0.70 | 0.07, 0.09, 0.16 |
| war / ash / ember | 0.96, 0.94, 0.90 | 0.78 | 0.82 | 0.12, 0.10, 0.08 |
| canyon / dusk / default | 1.06, 0.97, 0.84 | 0.90 | 0.82 | 0.16, 0.09, 0.03 |

Frost extras (GPU_VER 24): `print 0.40,0.50,0.48` (NOT 0.08 hoverboard, NOT 0.66-invisible) · `CONTACT_K 0.34` **two paws** `rx=0.36*pw` `ry=0.20*pw` · `PAW_SINK=0.072` · `uNeon=0.42` · `uSnow=0` · `reflectK 0.26` (0 in jump).

Never ship one studio grade on every biome.

---

## Ground FX (law 16, code = `wet-fx.ts`)

- Spawn on plant (`STRIDE_HZ≈4`), grounded only. Jump = no spawn.
- Prints: multiply ellipses, **slide toward camera** (canvas Y↑) with the plate. Cap 10. Frost colour **packed snow** `[0.40, 0.50, 0.48]` α 0.55 — dark multiply 0.08 = skateboard, 0.66 α 0.32 = invisible.
- Drops: Euler — gravity, Stokes drag (`k≈4.4/r`), bounce 1–2, split, then merge to a print. Cap 28. Frost emit 7 crystals.
- Kind from `{PAINT}`: frost/tide = water · ember = ash · canyon = dust · crystal = glitter.
- **Not** a full-screen loop of `exp()` (kills llvmpipe / cheap GPUs). Quads only.

---

## Clock

```
CYCLE_FPS = 96
CYCLE_FRAMES = 534
STRIDES_PER_CYCLE = 22
bolt.loop = true
playbackRate = 1
```

Never `*24` / 1-of-N on the dog. Never 0.93 s / 89-frame archive as play.

---

## Smoke (new biome)

| Check | PASS | FAIL |
|---|---|---|
| Gallop | fluid, native 96, **sharp interior** | stop-motion / skate / **body blur** |
| Legs | hind paws intact, plant the road | chopped / fade / hoverboard blob |
| Grain | film grain | **vertical bars** |
| Light | coat matches THIS plate, **no neon stripe through torso** | studio sticker / green dash in coat |
| FX | biome-correct, scroll with road | same white splash / stuck to screen / black prints |
| Scale | withers KEEP ~0.10 on law-20 wide road | lane-width fill / truck |
| Jump | dog still readable | vanishes into fog |
| Alpha | straight over, premul **only** in the 3-tap filter | double unpremul blown edges |

Related: [22](22-gpu24-frost-keep.md) · [15](15-gpu-compositor.md) · [16](16-biome-ground-fx.md) · [13b](13b-anti-sticker-contact.md) · [32](32-howl-gpu-targets.md) (keyed obstacles / shatter — same anti-sticker quad; Howl plate is Imagine VIDEO, not a filament shader) · [20](20-default-plate-proportions.md) · [00](00-PRIORITY0-any-biome.md) · [WIRE](../scripts/bolt-key-gl/WIRE.md)
