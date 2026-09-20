# 20b — Frost aurora KEEP + visual / φ measures

**Appendix to [20 — Default plate proportions](20-default-plate-proportions.md).** Not a second law 20.

**Sealed 2026-09-20 (SmiR phone review).** Hang ≠ wipe. Beat stays hung.

Any-biome empty stills start from **law 20** — the **full** measure set (frame + scale + GPU start knobs), not φ-only. This file is the **Frost aurora KEEP** that **proved** those numbers. Frost **paint** (aurora, neon dashes, thin snow, encode, hang path) stays here. Frame / scale / sat·bounce·contact **defaults live in [20](20-default-plate-proportions.md)** and apply to Tide / canyon / ember too.

Audience: a cold Grok who is about to recook Frost because “the last ice plate looked like shit.” Read **law 20** first, then this **before** Imagine. The KEEP is a **wide 3-lane night highway** with aurora + thin snow + aurora-green neon dashes. Bolt is the sealed 6 s overlay (law 17). Never bake the dog into the plate.

Phone verdict: *« Ha bah là c'est quand même beaucoup beaucoup »* then *« la route est plus large et ça rend mieux »*.

---

## KEEP plate (HARD)

One empty Frost plate. No bar / blast cousins until SmiR asks.

| | Law |
|---|---|
| Camera | Lock-off chase, first ≠ last (closer rush). Road stays a **complete** 3-lane highway — **no ice hole** at the vanishing point. |
| Paint | Night ice canyon. Vivid **green aurora** in a dark sky. Vertical crystalline cliffs. |
| Road | **Thin translucent powder snow** — dark wet asphalt still shows through. Not a white blanket. Not Beat wet-only. |
| Dashes | White lane marks become **aurora-green neon tubes** (same green as the sky), reflecting on the snow. |
| Bolt | **ZERO dog in the mp4.** Overlay = `lock/bolt-gallop-cycle.mp4` via law 17 GPU. |
| Encode | 720×1280, 48 fps, CRF 18, yuv420p, bt709, `+faststart`. Native ~6.04 s. Do **not** 2.7× `setpts` warp. |
| Hang | `public/master/road-frost.mp4` after Beat. `BOOT` may land on Frost. Never overwrite `road.mp4`. |

**FAIL:** ice crater / void at vanishing · crystal slab bar filling the lens · recook from Beat first-frames (“photographic wet asphalt”) · warp to 2.25 s · bake Bolt · CSS decoder collapsed to 2 px (not real 720p).

---

## Why this reads 10× better than the ice-hole Frost

The Beat 0–4 s phone clip (jersey + wet asphalt) was sharp because it was a **readable highway**. The ice-hole Frost was a **corridor**: walls eating the frame, void at the vanishing point, Bolt filling the lane → sticker.

This KEEP is a **nationale**: camera further back, 3 lanes drawn by neon, cliffs recede, aurora takes the extra 9:16 sky. Bolt is a dog *on* a road, not a sticker that *is* the road.

---

## Visual proportions (measured 2026-09-20, 720×1280, plant `y = 0.80`)

These measures **are law 20** (copied here as the KEEP that sealed them). Frame UV. `w` in PATH_TABLE = **one-lane half-width**. 3-lane full width = `6w`.

| | Frost aurora KEEP | Beat empty | PATH_TABLE (code) |
|---|---|---|---|
| 3-lane width at plant | **~0.75–0.82** | ~0.55–0.67 | **0.65** (`w=0.1085`) |
| 3-lane at `y=0.70` (neon outer) | **0.726** (px 130–650) | ~0.49 | 0.526 |
| 1-lane at plant | ~0.25 | ~0.18–0.22 | 0.217 |
| Sky | **~45 %** aurora | ~15 % fog | — |
| Vanishing | high, ~center `x≈0.53` | lower, enclosed canyon | PATH far `y=0.22` |

Neon peaks at `y=0.70`: `[130, 387, 635, 650]` → three lanes, center slightly right (`x≈0.54`).

PATH is still Beat-calibrated. Visual Frost is **wider**. Dodge L/R stays *on* asphalt but *inside* the neon. **Do not widen PATH to 0.80 and re-run 13d** — `laneFracMax=0.55` would grow Bolt ~+22 % and return the truck.

---

## Bolt scale on this plate (13d, do not “fix by eye”)

Live dpr2 canvas 1440×2560. Stance scan at 384×584 (`withersH≈148`, `stanceW≈96`).

| | Live KEEP | Law 13d band |
|---|---|---|
| `laneFrac` vs **PATH** lane | **0.55** (ceiling) | [0.30, 0.55] |
| `laneFrac` vs **visual** lane | **~0.40** | — |
| `withersFrac` | **~0.10** | target 0.27, band 0.22–0.32 |
| Dest sprite `384×584 × scale` | ~0.41 of frame H | — |

`withersMin` is **soft** (13d). On a wide nationale, hitting 0.22 withers = dog≈truck. **KEEP the small dog.** The screenshot SmiR gave as teacher already had this ratio. This **is** the law 20 default for any wide road — not Frost-only.

`PAW_PLANT = 0.80` (+ `PAW_SINK=0.072` → paws ~0.87). Contact `k` frost **0.34** as **two paw** gaussians (one body ellipse = hoverboard). Shadow `ry=0.20*pw`.

---

## Golden ratio (φ) — measure, do not myth

`φ = 1.618` · `1/φ = 0.618` · `1/φ² = 0.382`

9:16 = 1 : **1.778**. Golden portrait is 1 : φ = 1 : 1.618. The extra **+0.16** is the aurora stage. A 1:φ crop cuts the sky. Do not reframe.

| Element | y (from top) | φ / thirds | Verdict |
|---|---|---|---|
| Horizon / road diamond starts | ~0.38 | **φ minor 0.382** | hit |
| Road takes the frame | ~0.62 | **φ major 0.618** | hit |
| `PAW_PLANT` | 0.80 | **0.5 + 0.5/φ = 0.809** | 11 px off |
| PATH plant sample | 0.86 | φ of lower third ≈ 0.873 | hit |
| Bolt X | **0.50** | not 0.382 / 0.618 | **correct** (chase cam) |
| Sky / ground | ~45 / 55 | φ would want 38 / 62 | extra sky = aurora |

Spiral from the paws (bottom) up the neon leading lines into the aurora. That is the picture.

**Ban:** move Bolt onto vertical φ 0.618. It unbalances the canyon. Beat was *not* on φ (horizon too low, road too narrow, no sky) — do not “doré-iser” Beat either.

---

## GPU (law 17) on this plate — used, not skipped

Live compositor **is** the GitHub stack (PR 83–86). Confirm before blaming “quality”:

**GPU_VER 24 — law 22 is the KEEP.** Neon through the coat / 5-tap body blur / hoverboard = FAIL. See [22](22-gpu24-frost-keep.md).

```
WebGL2 two-pass   GPU_VER = 24
  pass 1  road + multiply contact (on the plate, not a sprite fade)
          uNeon bloom on dashes; uSnow=0 (snow already in the mp4)
  pass FX Euler prints/drops (Stokes k≈4.4/r) — no SPH / Box2D
          frost print RGB [0.40, 0.50, 0.48]  (packed snow; 0.08 = skateboard, 0.66 = invisible)
  pass 2  Bolt quad uRect 13d
          hard 0.157/0.063 + luma protect < 0.14
          leftover-G kill + mild erode 0.32
          3-tap smear dy=0.0030 EDGE ONLY (cSharp = k0.rgb straight)
          bounce 0.42 on neon-stripped bounceSrc (3-tap neighborhood)
          mix 0.11 bounceSrc interior — NEVER mix(c, plate) raw
          hemi IBL sky(0.50,0.78)+walls ±0.14
          dual-paw shadow + ice Fresnel/streaks/sparkle + Bolt mirror 0.26
          sin grain (not IGN-fract)
          blend SRC_ALPHA, ONE_MINUS_SRC_ALPHA  (straight over)
rVFC stamp  ·  texSubImage2D  ·  GPU_VER remount
CLOCK  96 fps / 534 / STRIDE_HZ=4 / playbackRate=1
```

Frost paint knobs (GPU_VER 24 KEEP):

```
cool  0.84, 0.93, 1.12
sat   0.54                 // 0.76 = studio sticker
under 0.70
rim   0.05, 0.10, 0.12     // aurora
bounce 0.42 on bounceSrc   // neonM chroma-kill
CONTACT_K 0.34             // dual-paw, not one oval
PAW_SINK 0.072
shadow two paws rx=0.36*pw ry=0.20*pw
print  0.40, 0.50, 0.48
drop   0.48, 0.94, 0.70
reflectK 0.26 (0 in jump)
```

Road shader may add a **neon bloom** on green dashes (`uNeon`) after the bake. Do not double-wash snow (`uSnow=0` when snow is already in the plate).

---

## Cook (if you must recook)

1. Start from [law 20 defaults](20-default-plate-proportions.md). Teacher: the aurora empty still (no wolf) — same camera, same cliffs, same sky.
2. I2V lock-off rush 6 s. Prompt HARD: *thin snow, asphalt shows through, green neon dashes, NO hole, NO dog*.
3. QC frames t=0 / 2 / 4 / last. Last closer. Road complete. Zero Bolt.
4. Encode 48 fps 720×1280 CRF 18. **No** `setpts` speed warp.
5. Hang as `road-frost.mp4`. Overlay sealed bolt. GPU 17. Scale 13d **as-is** (do not grow).

Related: [20](20-default-plate-proportions.md) · [22](22-gpu24-frost-keep.md) · [17](17-live-compositor.md) · [13d](13d-auto-scale.md) · [13b](13b-anti-sticker-contact.md) · [12](12-lane-path-ribbon.md) · [08](08-plate-speed.md) · [00](00-PRIORITY0-any-biome.md) · paste [COLD_START-gpu24.md](COLD_START-gpu24.md)
