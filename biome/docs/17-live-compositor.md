# 17 — Live compositor (what actually stuck Bolt to the plate)

**Audience:** a cold Grok porting [`bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts) into Live.  
**This is the Frost-parity recipe.** The old scissor / IGN-fract file is **ARCHIVE** (`bolt-key-gl-scissor-prev.ts`). Copying it = **FAIL** (vertical bars + eaten hind legs + sticker).

Sealed 2026-09-20 after Frost Live. Hang ≠ wipe.

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

Ban: fade `py>0.90` on the sprite (eats paws). Contact shadow is **on the road**, not a sprite fade.  
Ban: SPH / Box2D / general physics engine.  
Ban: baking Bolt into the road mp4.

---

## Stack (GPU family, law 15)

```
pass 1  road fullscreen  + multiply contact shadow + sin grain
pass FX prints (DST_COLOR) + drops (additive) as tiny quads
pass 2  Bolt quad only: key + despill + sat/cool + plate bounce + 3-tap smear + edge smoothstep
```

`makeCompositor(canvas)` **before** `getContext("2d")`.  
`preserveDrawingBuffer: false`. `premultipliedAlpha: true`.  
Road upload gated ×24. Bolt upload on **new rVFC mediaTime** (or currentTime if no rVFC). After first alloc: `texSubImage2D`.

Paw/stance scan **once** at boot (13d) on a standing frame — not 60×/s.

---

## Key (do not retune by eye)

```
greenness = G - max(R,B)
hard = G>0.157 && greenness>0.063
soft = G>0.118 && smoothstep(0.016, 0.063, greenness)
protect = luma<0.14 && greenness<0.12     // dark paws
alpha = max(1 - mix(soft,1,hard), protect)
despill: G → max(R,B)
```

Then `a = smoothstep(0.05, 0.78, a)` — dirty edge, not knife.

---

## Anti-sticker = light from THIS plate (HARD)

After key:

```
bounce = plateRGB / max(plateLuma, 0.07)
c *= mix(1, bounce, 0.32)          // frost aurora KEEP: 0.40 (neon road) — [20b](20b-frost-aurora-proportions.md)
c  = mix(c, plate, 0.10)
rim *= 0.35
3 vertical taps (dy≈0.0055) to pick up plate shutter
```

Biome knobs (`uniformsFor(chap)`):

| `{PAINT}` | cool | sat | under | rim |
|---|---|---|---|---|
| frost / ice / crystal | 0.84, 0.93, 1.12 | **0.60** (was 0.58; 0.76 = studio sticker on neon snow) | 0.74 | 0.04, 0.055, 0.08 |
| tide / wet | 0.82, 0.95, 1.08 | 0.62 | 0.76 | 0.05, 0.09, 0.12 |
| night | 0.78, 0.84, 1.14 | 0.68 | 0.70 | 0.07, 0.09, 0.16 |
| war / ash / ember | 0.96, 0.94, 0.90 | 0.78 | 0.82 | 0.12, 0.10, 0.08 |
| canyon / dusk / default | 1.06, 0.97, 0.84 | 0.90 | 0.82 | 0.16, 0.09, 0.03 |

Never ship one studio grade on every biome.

Frost contact `k` **0.20** on bright snow (0.34 punches a skateboard-box). Shadow on the **road**, ellipse flat, not a dark rectangle under the paws. Empty-still framing = [20](20-default-plate-proportions.md); Frost KEEP numbers = [20b](20b-frost-aurora-proportions.md).

---

## Ground FX (law 16, code = `wet-fx.ts`)

- Spawn on plant (`STRIDE_HZ≈4`), grounded only. Jump = no spawn.
- Prints: multiply ellipses, **slide toward camera** (canvas Y↑) with the plate. Cap 6.
- Drops: Euler — gravity, Stokes drag (`k≈4.4/r`), bounce 1–2, split, then merge to a print. Cap 16.
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
| Gallop | fluid, native 96 | stop-motion / skate |
| Legs | hind paws intact | chopped / fade |
| Grain | film grain | **vertical bars** |
| Light | coat matches THIS plate | studio sticker |
| FX | biome-correct, scroll with road | same white splash / stuck to screen |
| Scale | laneFrac ≤ 0.55 (13d). Wide law-20 road: withers ~0.10 is KEEP ([20](20-default-plate-proportions.md)) | lane-width fill / grow to 0.22 on a wide road |
| Jump | dog still readable | vanishes into fog |

Related: [15](15-gpu-compositor.md) · [16](16-biome-ground-fx.md) · [13b](13b-anti-sticker-contact.md) · [20](20-default-plate-proportions.md) · [20b](20b-frost-aurora-proportions.md) · [00](00-PRIORITY0-any-biome.md) · [WIRE](../scripts/bolt-key-gl/WIRE.md)
