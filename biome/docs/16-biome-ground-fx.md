# 16 — Biome ground FX + grade (Frost-parity, any biome)

**Goal:** paw contact must read on the road — not a floating sticker. Frost Live had **contact shadow + ground reaction** (prints / splash / dust). Every biome gets a row. GPU compositor draws these in the same pass family as law 15 (or a cheap overlay pass). Phase-lock to gallop plant frames (`stridePhase` / paw plant ≈ 0.8).

## Shared rules (all biomes)

| Rule | Law |
|---|---|
| Shadow | Soft ellipse **multiply** under stance paws on the **road** (13b). `shadowK` ↓ in air / jump. |
| Prints / splash | Spawn only on **plant** frames (trailing/leading hind or fore that touches). Never continuous ribbon under floating dog. |
| Lifetime | Fade in ≤1 stride; fade out 2–4 strides or when plate scrolls them off-screen. |
| Placement | Ribbon `(s, λ)` under paws — [12](12-lane-path-ribbon.md). |
| Color | Sampled / graded from **this** empty plate (not pure black studio). |
| Perf | Prefab sprites or shader blobs — never CPU `getImageData`. Cap active FX (e.g. ≤12). |
| Ban | Full-body drop shadow · baked shadow in `bolt.mp4` · FX that ignore biome (same white splash on ember). |

## Grade from plate (always)

After key+despill, before Hang:

1. Measure plate mid-frame: mean hue / sat / lift in lower-third road band.
2. Apply to Bolt coat: desat toward plate, tint toward plate sky/road, belly slightly darker, thin rim from sky side.
3. Share one grain layer over plate+Bolt (13).

## FX table — pick the row matching `{PAINT}`

| Biome family | Grade | Paw print | Splash / kick | Notes |
|---|---|---|---|---|
| **Frost / ice / snow** | Cold desat, cyan-blue rim, belly darker | Soft blue-white compress in snow | Fine ice spray / glitter on plant | Shadow cooler; never warm studio |
| **Tide / wet / rain** | Cool teal, specular lift on coat edges | Dark wet oval on asphalt | Water crown / droplet arc | Stronger specular; mute spray in heavy fog |
| **Canyon / dusk / dry** | Warm dusk grade, orange rim | Dust stamp / tire-dust puff | Light grit puff | Keep dust opacity low |
| **Night / neon** | Low sat, neon rim from plate lights | Dark matte print | Minimal sparkle if wet | Don’t invent neon on coat not in plate |
| **War / ash / ember** | Desat + warm ash, red-orange rim | Dark ash print | Ember flecks / ash puff | No lava unless plate has it |
| **Crystal / prism** | Cool high-sat rim from plate crystals | Soft luminous print | Tiny prism flecks | Identity stay white GSD |
| **Default / unknown `{PAINT}`** | Sample plate mid → nearest row above | Generic soft multiply stamp | Soft dust or mist matching plate albedo | Prefer dust over water if unsure |

## Implementation sketch (Live)

```
phase = stridePhase(plate_time)   // 14c
onPlant = phase near plant windows (doc 14)
if (onPlant && grounded):
  spawnFX(biomeRow, ribbonPoint(s, λ_paws), plateGrade)
shadowK = grounded ? 1 : 0.25
compositor.draw({ ..., shadowK, fxList })
```

Wire with GPU compositor ([15](15-gpu-compositor.md)). Update FX uniforms when biome/plate changes — one code path, many rows.

## QC / Smoke

| Check | PASS | FAIL |
|---|---|---|
| Plant | Print/splash appears under paws on plant | FX under belly in air |
| Scroll | FX scroll with road | Stuck to screen |
| Biome | Frost≠ember FX | Same white splash everywhere |
| Shadow | On road, multiply | Detached blob / none |
| Perf | 60-ish display, no getImageData | CPU key return |

## Related

[13b](13b-anti-sticker-contact.md) · [13](13-make-bolt-lane.md) · [14](14-rotary-gallop.md) · [14c](14c-gallop-clock.md) · [15](15-gpu-compositor.md) · [00-PRIORITY0-any-biome.md](00-PRIORITY0-any-biome.md)
