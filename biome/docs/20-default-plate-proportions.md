# 20 — Default plate proportions (any biome still)

**Sealed 2026-09-20 (SmiR).** Hang ≠ wipe.

**Default starting skeleton** for a cold Grok cooking **any** Lane biome empty still / Video A — not Frost-only, **not φ-only**.

This is the **full measure set** from the Frost aurora KEEP (PR #92 / 20b). Tide / canyon / ember / invented `{PAINT}` start from **these same numbers**. Frost aurora remains the **worked example** that already hits them. Player (or explicit paint) may adapt. Without override, Grok **starts here**.

φ is a **composition audit only**. The law is the table + scale + GPU start knobs below.

## Default frame (9:16, chase cam behind Bolt)

Measured 2026-09-20 on the Frost aurora KEEP (720×1280, plant `y = 0.80`). Frame UV. `w` in PATH_TABLE = **one-lane half-width**. 3-lane full width = `6w`.

| Measure | Default (any biome) | Beat empty (FAIL as silent default) | PATH_TABLE (code) |
|---|---|---|---|
| 3-lane width at plant | **~0.75–0.82** of frame | ~0.55–0.67 | **0.65** (`w=0.1085`) |
| 3-lane at `y=0.70` | **~0.73** | ~0.49 | 0.526 |
| 1-lane at plant | **~0.25** | ~0.18–0.22 | 0.217 |
| Sky / upper void | **~45 %** (band ~0.35–0.50) | ~15 % | — |
| Horizon / road diamond | **~0.38** from top | too low | PATH far `y=0.22` |
| Road takes frame | **~0.62** lower mass | enclosed corridor | — |
| Paw plant Y | **~0.80** (`PAW_PLANT`) | — | PATH plant sample 0.86 |
| Vanishing | high, near center | lower, ice-hole / canyon | — |
| Bolt X | **0.50** | — | chase cam |

Wide chase road. Ban ice-hole / tiny ribbon. Sky room for weather / aurora / dusk. Camera lock-off, first ≠ last, ZERO dog in the plate.

PATH is often still Beat-calibrated (~0.65). Visual road is **wider**. Dodge L/R stays *on* asphalt but *inside* the painted lanes. **Do not widen PATH to 0.80 and re-run 13d** — `laneFracMax=0.55` would grow Bolt ~+22 % and return the truck.

## Default Bolt scale (13d — do not “fix by eye”)

On this wide skeleton, Live KEEP is the **small dog**.

| | Default KEEP | 13d band (do not fight) |
|---|---|---|
| `laneFrac` vs **PATH** lane | **0.55** (ceiling) | [0.30, 0.55] |
| `laneFrac` vs **visual** lane | **~0.40** | — |
| `withersFrac` | **~0.10** | target 0.27, band 0.22–0.32 |
| Dest sprite | ~0.41 of frame H | — |

`withersMin` is **soft** (13d). Hitting 0.22 withers on a wide nationale = dog≈truck. **KEEP ~0.10.** `PAW_PLANT = 0.80` (+ `PAW_SINK=0.05` → paws ~0.85).

**FAIL:** grow Bolt 2–3× to fake withersMin 0.22. **FAIL:** widen PATH to the visual lanes then re-run 13d.

## Default GPU start knobs (law 17 + **21** — biome-adaptable)

Start every new biome from these knobs. Then `uniformsFor(chap)` may adapt cool / sat / under / rim to **this** `{PAINT}`. Do not ship one studio grade. Do not start from the old 0.32 bounce / 0.34 contact / 0.58 sat. **Do not** `mix(c, plate, 0.10)` raw — that paints neon dashes through the coat ([21](21-neon-premul-anti-sticker.md)).

```
bounce   0.36 on bounceSrc   // neon-stripped 3-tap neighborhood (raw plate leaked dashes)
mix      0.09 bounceSrc      // NOT raw plate
sat      0.56                // start; 0.76 = studio sticker. uniformsFor may shift
CONTACT_K 0.20               // start on a readable road (0.34 punches a skateboard-box)
rim      ×0.55
smear    3-tap dy=0.0030 EDGE ONLY, cSharp = k0.rgb straight
print    frost [0.66, 0.74, 0.70]  // <0.3 = hoverboard
GPU_VER  20
```

Cool / under / rim hue still follow the [17](17-live-compositor.md) paint table. Contact shadow stays on the **road**, ellipse flat (`ry=0.24*pw`) — not a dark rectangle under the paws. Bounce / sat / contact may move if the player’s paint is darker, wetter, or hotter. **Start here.** Full neon / premul / blur FAIL table: [21](21-neon-premul-anti-sticker.md).

## φ — audit only (not the law)

\(\varphi \approx 1.618\) · \(1/\varphi = 0.618\) · \(1/\varphi^{2} = 0.382\).

Use as a **composition check**, not a religion. Engine laws 13d / 17 / 19 win on conflict.

| Element | Default y | φ | Audit |
|---|---|---|---|
| Horizon | ~0.38 | φ minor 0.382 | hits |
| Road takes frame | ~0.62 | φ major 0.618 | hits |
| `PAW_PLANT` | 0.80 | \(0.5 + 0.5/\varphi = 0.809\) | close |
| Bolt X | **0.50** | not 0.382 / 0.618 | **correct** — do not φ-offset X |
| Sky / ground | ~45 / 55 | φ would want 38 / 62 | extra sky is KEEP |

9:16 = 1 : **1.778**. Golden portrait is 1 : φ. The extra **+0.16** is the weather stage. Do not crop to 1:φ.

**Ban:** move Bolt onto vertical φ 0.618. **Ban:** treating φ as the whole of law 20.

## What Grok does on a new convo

1. Empty still: 3 wide lanes, vanishing point, ZERO dog, camera lock. Hit the **full** tables above.
2. Video A rush 48fps from that still pair.
3. REUSE 6s Bolt + GPU 17 — start knobs above, then adapt grade to `{PAINT}`.
4. Scale 13d **as-is** (withersFrac ~0.10 KEEP). Proportions stay on the **plate**, not by baking Bolt bigger.

## Player override

Chat / paint may ask tighter road, lower horizon, more sky, hotter sat, etc. Then hang that as the biome’s KEEP. Catalog still lists hung only.

## FAIL (default cook)

- Ice-hole / Beat-narrow road as silent default
- Sky ~15 % / corridor walls eating the frame
- Growing Bolt to fake withersMin 0.22 on a wide road (truck)
- Widening PATH to the visual lanes then re-running 13d
- Starting GPU from old 0.32 bounce / 0.34 contact as if that were the default
- Baking Bolt into the plate
- Inventing gallop
- Treating φ (or φ-X) as the whole law

## Related

[00](00-PRIORITY0-any-biome.md) · [13d](13d-auto-scale.md) · [17](17-live-compositor.md) · [19](19-luminous-path-climb.md) · Frost aurora worked example (paint + KEEP that proved these numbers): [20b-frost-aurora-proportions.md](20b-frost-aurora-proportions.md) · paste [COLD_START-any-biome.md](COLD_START-any-biome.md)
