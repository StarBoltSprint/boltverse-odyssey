# Ground — the approved recipe (any biome)

Back to [METHOD.md](../METHOD.md). **Status: APPROVED look — SmiR, 2026-10-03** (zone A step 1, PR #156). Merged to main 2026-10-03 as part of zone A. **Not VALIDATED:** the slope fix is deferred and waits for SmiR's phone check.
**Relief fixes still pending** (§13): deferred. PR #156 was merged with zone A on 2026-10-03 before they landed (owner approval 21:56 Paris).

This page is self-contained: a fresh Grok (or a player) who reads only this page can rebuild the zone A ground and make the
ground of another biome at the same quality. Part 1 is the generic recipe, driven by the biome kit. Part 2 is the filled-in
example (The Howling Eclipse, zone A). Exact zone A prompt strings carry palette words, so they live in an untracked file
(law, 2026-10-03: palettes and Imagine prompt text stay out of tracked files):
`/workspace/grokcli/next/METHOD/ground-prompts.local.md` and `/workspace/grokcli/out/zoneA-step1/provenance.json`.

## 0. What a ground is (three layers, all mandatory)

| Layer | What | Who makes the pixels |
|---|---|---|
| **1. Volume** (invisible) | Macro height relief (shape of the land) **+** per-pixel micro relief taken from each Imagine tile by monocular depth + light high-pass. Baked into one static mesh. | Nobody: it is shape only, never drawn. |
| **2. Skin** | 3–4 **material families** of top-down Imagine tiles (2 variants each), world-locked, chosen per place **by the relief**, variants mixed by an **Imagine mask**. | Imagine |
| **3. Anti-carpet** | Small Imagine **cutouts** (≤ 0.30 m) standing up on the ground; relief silhouettes against the sky; fog / grade / bloom post (law 67). | Imagine (+ law 67 post) |

Code computes shape and placement only. No code colour, gradient, noise texture, light, shadow or normal map, ever.
Magnification ≤ 1.0 on the 720×1600 phone view for every visible texel, slope stretch included (law 65).

## Part 1 — Generic recipe

### 1. Inputs

| Input | Where it comes from | Used for |
|---|---|---|
| `id`, `name`, `timeOfDay`, `paint`, `sun.{azimuthDeg,elevationDeg,kelvin}`, `palette.{ground,accent}` | `biome/kits/<id>.json` — print with `python3 tools/kits/kit.py show --id <id>` | Prompt slots only. Never typed into code. |
| Material words per family, cutout subjects | Untracked `*.local.*` file you write (e.g. `/workspace/grokcli/next/METHOD/ground-prompts.local.md`) | Prompt slots `{FAMILY_MATERIAL}`, `{CUTOUT_SUBJECT}` |
| Volume numbers: relief amplitude, roughness (feature widths, crack field), per-family depth strength, tile size, mask scale | Today: constants in `packs/<zone>/play/field.js` and `terrain.js` (zone A values in §10). Planned: a numbers-only `ground` block in the kit — issue [#157](https://github.com/StarBoltSprint/boltverse-odyssey/issues/157). | Layer 1 and 2 |
| Depth model | `/workspace/grokcli/models/depth_anything_v2_small.onnx` (input `pixel_values`, output `predicted_depth`); onnxruntime + PIL via `export PYTHONUSERBASE=/workspace/x-live/chrome-game-home/.local` | Micro relief |

### 2. Checklist (one step, ~1 h)

1. `python3 tools/kits/kit.py show --id <id>`; write the local material file: **3–4 families** that fit the biome, each with a
   **relief role**: high ground / ridges, hollows / basins, default flats, crack or channel bands. Pick materials with real
   physical structure (plates, joints, grains, ridges, cracks, pebbles): the depth model turns that structure into volume.
2. Imagine: per family one tile (T1) + one variant edit (T2) = 2 slots; one mask (T3); 2–3 cutouts (T4). ~12 calls.
   Space the calls (an `image_edit` burst returned HTTP 429 in zone A) and retry a 429 once later; never fill a slot by copy.
3. Copy the stills into `/workspace/grokcli/out/<step>/stills/` and record provenance (call id, prompt, sha256).
4. Prep (§4): seam join, depth high-pass maps, keyed cutouts.
5. Volume (§5): footprint + macro relief + micro relief, inside the targets (≤ 3 m per ≥ 20 m, ≤ 15°).
6. Skin (§6) and cutouts (§7); post (§8 settings).
7. QC (§9): boot clean, walk mag ≤ 1.0, relief rows, and the eye shots **wide**, **Bolt-height**, **close-up**.
8. Report + owner QC on the phone. Stop after 2 failed attempts at the same defect; list it.

### 3. Imagine prompt templates

All calls `aspect_ratio: "1:1"` (≈ 1024×1024). `{…}` are slots. Slots marked *kit* are copied from the kit, never invented.

**T1 — family tile** (`image_gen`)

```
Square seamless orthographic ground photograph, camera perfectly straight down, no horizon and no vanishing point.
{FAMILY_MATERIAL — 1–2 sentences: material, its structure, what sits in the joints/cracks, scale cue}.
{timeOfDay (kit)}, one sun at azimuth {sun.azimuthDeg (kit)} degrees and elevation {sun.elevationDeg (kit), negative
written as "minus N"} degrees, {sun.kelvin (kit)} kelvin, ground colour near {palette.ground (kit)} with accent
{palette.accent (kit)}. Even scale across the whole frame, no animals, no text, no sky.
```

**T2 — variant of a family** (`image_edit`, one source = the T1 still)

```
Same straight-down orthographic {FAMILY_SHORT — 4–8 words of the T1 material}, same {timeOfDay} light.
{CHANGE}. No horizon, no animals, no text.
```

`{CHANGE}` used in zone A: "A different arrangement of the cracks, still irregular and sharp." · "A different drift of the
ridges and grains." · "A different branch pattern." · and, when a T1 came out as a regular polygon grid:
"Break the regular polygon grid into jagged irregular plates of different sizes." (that edit replaced the grid as variant 0).

**T3 — variant mix mask** (`image_gen`, same text for every biome, no style)

```
Square seamless orthographic texture, camera straight down, no horizon. Irregular soft-edged organic blotches, some near
white and some near black, grayscale only, no objects, no text, even flat lighting, a soft mix mask.
```

**T4 — ground cutout** (`image_gen`, one per subject; black background so the key comes from Imagine pixels)

```
Side view of {CUTOUT_SUBJECT}, about {HEIGHT} centimetres tall, isolated on a pure black background, lower middle of the
frame. {timeOfDay (kit)}, one sun at azimuth {sun.azimuthDeg} degrees, elevation {sun.elevationDeg} degrees,
{sun.kelvin} kelvin. No ground plane, no sky, no text.
```

Cutout heights: 15–30 cm (one cluster ~30, one low ridge ~15, one raised lip ~20). Taller things are objects (8-view carving).

Note: the kit rule says to paste `promptPreamble` verbatim. The approved zone A stills used the inline sun/palette sentence
of T1/T4 instead. To reproduce the approved look, use T1–T4 as written.

### 4. Prep: tiling, depth / height map, high-pass (`packs/<zone>/src/terrain/prep.py`)

Pixel operations only; no colour is invented. For each still (sizes 1024×1024 in zone A):

1. **Seam join** `join_edges(img, band=0.09)`: in a band of 9 % of the width/height, cross-fade each edge toward the
   average of itself and the mirrored opposite edge (linear weight 1→0). Opposite edges become equal, so the tile wraps
   (`REPEAT`). Print `seam_score` (edge diff / interior diff): 0.000 by construction. It does not prove the tile looks
   seamless; judge the wide shots.
2. Save RGB PNG as `m<i>.png` (albedo slot `i`) and the mask as `mask.png` (never a depth source).
3. **Depth** (only names `m<digit>.png`; `mask.png` once became `hask.png`): resize to 518×518 bilinear, ImageNet
   normalise (mean 0.485 0.456 0.406, std 0.229 0.224 0.225), run the ONNX model, min-max to 0..1, resize back.
4. **High-pass**: `detail = depth − gaussian(depth, σ = 14 px)` (wrap padding); divide by the 95th percentile of |detail|;
   clip ±1.2; `gaussian(σ = 1.2 px)`; clip ±1. This keeps cracks, plates and grains, drops the model's whole-frame tilt.
5. Store `h<i>.png` as 8-bit gray `128 + 100·detail` (so `(byte − 128) / 100` gives −1..1 back).
6. **Cutouts** `key_cut(src, dest, lo, hi)`: luma (Rec. 709) → `t = clamp((lum − lo)/(hi − lo))`, smoothstep → alpha;
   crop to alpha > 24 bounds, pad 8 px, RGBA PNG. Zone A limits: cluster 14/40, low ridge 16/42, lip 18/48.

Edit the `TILES`, `MASK`, `CUTS` maps and the `key_cut` limits for a new set. Inputs come from `GROUND_SRC` (default: the
zone A session folder; backup `/workspace/grokcli/out/zoneA-step1/stills/`). Outputs go next to the script's repo root.

### 5. Layer 1 — the volume under the plates (mandatory, `packs/<zone>/play/field.js`)

Pure numbers, no pixels. `heightAt(x, z) = macroAt(x, z) + microAt(x, z)`, used by the mesh, Bolt's feet and the camera.

**Footprint.** Irregular, no circle: `r(θ) = SCALE·(1 + Σ aₖ sin(kθ + φₖ))`, `SCALE` solved so the area is the target
(zone A: 6500 m², harmonics k = 2, 3, 5, 7). `contain()` holds Bolt at 1.045 r(θ). Simplex or other placement noise is also
allowed for shape; zone A used analytic features.

**Macro relief** = a sum of smooth features (Gaussian bumps/dips, a meandering channel, a crack field), each with an
**amplitude A** (m) and a **width σ** (m) = the roughness. Design rule for the targets: a Gaussian's steepest slope is
`0.607·A/σ`, so **slope ≤ 15° (0.268) needs σ ≥ 2.27·A**, and **≤ 3 m span over ≥ 20 m** caps A at 3 m for features
narrower than ~20 m. Taller cliffs are objects, not relief. Keep a raised boundary inside the same limits (or make it objects).

**Micro relief from the images** (the approved per-pixel depth carrier, law 59): `microAt = MICRO_family ·
(h_family(x/TILE, z/TILE) − 128)/100`, bilinear, wrapped, world-locked with the albedo. Zone A: `MICRO = 0.1 m` for every
family, sampled from the `h` of the family's first slot.

**Mesh** (`terrain.js buildMesh`): one regular grid, n = 300 cells across `2 × 1.08 × maxRadius` (zone A step 0.435 m,
40 829 verts, 77 310 tris), cells outside 1.06 r(θ) dropped, `heightAt` baked into static vertex Y once at boot; per vertex:
position, tile UV `x/TILE`, family id, mask UV `x/8.5 m`. One draw call. No normals (no lighting exists).

**Volume inputs per biome** (today constants in `field.js` / `terrain.js`; planned numbers-only kit `ground` block, #157):

| Input | Meaning | Zone A (approved look) | Rule for any biome |
|---|---|---|---|
| relief amplitude A (m) | height of each macro feature | crest 6.4 (soft cap 5.2), ridge 3.1, basins −2.2 / −1.2, channel −1.05, rim berm +2.6 | ≤ 3 m per ≥ 20 m |
| roughness σ (m) + crack field | feature widths; crack frequencies | σ 5.6–18 m; crack 0.29 / 0.16 / 0.24 / 0.12 rad/m, dip 0.105 m | σ ≥ 2.27·A (slope ≤ 15°) |
| depth strength per family (m) | `MICRO_family` scale of the image-depth relief | 0.1 for all four families | keep 0.1 unless the owner asks; same for both slots of a family |
| tile size / mask scale (m) | world size of one tile / of the mask | 1.45 / 8.5 | §6 formula (mag ≤ 1.0) |

### 6. Layer 2 — materials distributed by the relief

- `familyAt(x, z)` on **macro** height (zone A thresholds): `h > 1.25 m` → ridges (slots 0/1); `h < −0.55` → hollows (2/3);
  crack field `< 0.13` → crack bands (6/7); `h < −0.15` → hollows; else flats (4/5).
- All slots in one `TEXTURE_2D_ARRAY` (RGBA8, `LINEAR_MIPMAP_LINEAR`, mipmaps, anisotropy ≤ 8, `textureGrad` with
  `fwidth(uv)` so `fract()` wrap does not break mips). Fragment: `mix(slot[fam], slot[fam+1], mask(worldXZ / 8.5 m))`.
  The mask is an Imagine image, so the variant mix is made of Imagine pixels.
- **Tile size**: largest that keeps mag ≤ 1 at the play eye: `TILE ≤ (eyeAboveGround / tan(VFOV/2)) · srcW / (FOCAL · stretch)`.
  Zone A: eye 1.22 m, VFOV 48.07°, FOCAL 1793.6 px, srcW 1024 → ≤ 1.56 m / stretch → **TILE = 1.45 m** (walk mag 0.912).

### 7. Layer 3 — cutout placement (`terrain.js buildCards`)

Deterministic hash `hash(i, k)`; up to 4000 tries until **200 points**; keep points inside 0.88 r(θ) with macro slope
(1.6 m baseline) ≤ 0.7. Subject by family: ridges → cluster (0.28 m); hollows → low ridge (0.16 m, kept 55 %); flats →
cluster (45 %) or lip (55 %); crack bands and the rest → lip (0.30 m). Cluster kept at 72 %. Yaw `hash·π`, scale 0.72–1.0,
base `heightAt − 0.02 m`. Each point = **two crossed vertical quads** (yaw and yaw + 90°) → **400 cards**, world-locked (never
camera-facing), one instanced draw, alpha discard < 0.18 + alpha blend, same texture-array filtering.

### 8. Post: fog, grade, bloom (law 67, `terrain.js`)

| | Setting |
|---|---|
| Fog colour | Mean of the sky slices' horizon band (rows 48–52 %, every 4th pixel), sampled at boot (`sampleHorizon`). Never typed. |
| Fog amount | `clamp(1 − exp(−0.015 · viewZ), 0, 0.58)` from the scene depth buffer (near 0.35, far 240). |
| Bloom | Bright pass `clamp((max(r,g,b) − 0.78)/0.22)` at half resolution, separable 5-tap blur (weights 0.227 / 0.316 / 0.070 at 0 / 1.384 / 3.231 texels), added × 0.11. |
| Grade | Fitted ACES curve mixed at 0.26, saturation × 1.05. One grade per biome. |
| Bolt | Drawn after the composite: grade only, no fog, no bloom (Bolt never glows). Post off = raw pixels. |

### 9. Phone and magnification checks — the entry point

```bash
cd <repo checkout with packs/<zone>>                       # zone A: branch zone-a-step1-ground
export PYTHONUSERBASE=/workspace/x-live/chrome-game-home/.local
GROUND_SRC=/workspace/grokcli/out/zoneA-step1/stills python3 packs/zone-a/src/terrain/prep.py   # rebuild assets
(cd tools/playcheck && npm ci)                               # once per checkout (playwright-core)
python3 -m http.server 8957 --bind 127.0.0.1 &               # any free port (not 8811 / 8765)
node packs/zone-a/src/terrain/qc.mjs http://127.0.0.1:8957 /tmp/ground-qc     # ~6 min on SwiftShader
# play: http://127.0.0.1:8957/packs/zone-a/play/index.html  (?debug=1 shows the HUD with mag)
```

Verified 2026-10-03: `prep.py` rebuilds all 20 zone A files (`m0–m7`, `h0–h7`, `mask`, `c0–c2`) **byte-identical**, and
`qc.mjs` boots clean. QC rows and shots (`qc.json` + PNGs, canvas read with `toDataURL`; `page.screenshot` can hang):

| Row / shot | Pass rule |
|---|---|
| `boot_clean` | 0 console errors / 4xx |
| `walk_mag_le_1` | 8 gallops from the centre, every frame mag ≤ 1.0 (ground mag includes slope stretch over a 2.2 m span, cards included) |
| `relief_span_le_3m_per_20m`, `slope_le_15deg` | walkable cells, 2 m slope baseline, 20 m windows (OPEN on zone A, §13). Zone B step 1 measured span 2.001 m and slope 14.50° (IN TEST, not a lock) |
| q1, q3–q5 chase · q2 rim | play camera; no flat cap above the sky (q2) |
| **q6 Bolt-height** | anti-carpet judge: relief silhouettes, lips, cutouts standing up (mag > 1 allowed, not a play camera) |
| **q7 close-up** | boom 4.2 m, play mag; materials rich, not plain dirt |
| **q8–q10 wide** (overview, oblique, top-down) | no visible tile grid, soft family transitions |

Engine hooks used (`window.__play`): `reset, place, setInput, tick, snapshot, lookAt, clearShot, setPost, groundInfo,
heightAt`. Proof poses of the approved shots: 01 `lookAt([-46,22,-28],[8,2,16])` · 02 chase `place(-2,2,24)` · 03 close
`place(-18,8,70)` boom 4.2 m, eye +1.15 · 04 chase `place(-24,-8,48)` · 05 chase `place(-16,10,80)` · 06 crest `place(10,16,32)`.

## Part 2 — Filled example: The Howling Eclipse (zone A step 1)

Kit `biome/kits/howling-eclipse.json` (sun, palette, time → T1/T4 slots). Session: 12 Imagine calls, 11 saved.
Commits `6afb2a2` (build) and `015544d` (notes) on PR #156.

### 10. Zone A values

| Family (slots) | Relief role | Material idea (exact words: local file) | Calls → still |
|---|---|---|---|
| 0 (m0, m1) | ridges, `h > 1.25 m` | angular rock plates split by thin glowing mineral veins, dust in the cracks | 46 → 4.jpg (m1); edit 57 → 8.jpg (m0, "break the grid") |
| 2 (m2, m3) | hollows | fine glittering dust with tiny sharp ridges and loose grains | 47 → 3.jpg (m2); edit 59 → 11.jpg (m3) |
| 4 (m4, m5) | default flats | glassy cracked plates, sharp shards, lit joints | 48 → 1.jpg (m4); edit 58 → 9.jpg (m5) |
| 6 (m6, m7) | crack bands | stone with branching faintly glowing cracks and raised lips | 49 → 2.jpg (m6 = m7: edit 60 hit HTTP 429) |
| mask | variant mix, 8.5 m | T3 verbatim | 50 → 5.jpg |
| c0 / c1 / c2 | cutouts | angular pebble cluster with two shards (~30 cm) / low glittering ridge (~15 cm) / raised cracked lip (~20 cm) | 61 → 10.jpg / 62 → 6.jpg / 63 → 7.jpg |

Volume constants (`field.js`): area 6500 m², footprint harmonics `0.22 sin(2θ+0.4) + 0.14 sin(3θ+1.15) + 0.09 sin(5θ−0.7) +
0.05 sin(7θ+2.05)` (SCALE 44.62, max radius 60.4 m). Macro features: far crest `6.4·crest^0.62` (σ 18 m along × 8.5 m
across, axis 0.55 rad at 0.62 r), soft-capped above 5.2 m (×0.18); ridge `+3.1` (σ 7.4 m, line `x + 11 − 0.26z`, window σ 18 m);
meandering channel `−1.05` (σ 5.6 m, centre `8.2 sin(0.08z)`); basins `−2.2` at (−20, 9) σ 12×8 m and `−1.2` at (15, −18)
σ 13×6.2 m; crack field `min(|sin(0.29x + 1.35 sin 0.16z)|, |sin(0.24z + 1.15 sin 0.12x)|)`, dip `(0.15 − c)·0.7` below 0.15;
rim berm `+2.6·t²` for u > 0.9. Micro: `MICRO = 0.1 m`, `TILE = 1.45 m`. Spawn (−6, −14) heading 32°.
`clearing.json` → `zone.ground`: `tile_m`, `tiles` (m0–m7), `depth` (h0–h7), `mask`, `details` (c0–c2); the play engine
switches to the relief path when `depth`, `mask` and `details` are present.

## Part 2b — Ember Mesa (zone B step 1) — IN TEST

Not a lock. Does not replace ground v1. Numbers from the 2026-10-04 browser grid (2 m cells, 2 m slope baseline, 20 m windows, u < 0.92). Material words stay in the local prompts file.

| Item | Measured |
|---|---|
| Pack | `packs/zone-b/` |
| Area | 7800 m², max radius 66.05 m |
| Rim | +0.9 m over the outer 18 m |
| TILE / MICRO / MASK_M | 1.50 m / 0.10 m / 22 m |
| Sources | 3 stills into 8 slots. Family 0 slots 0–1, family 2 slots 2–3, family 4 slots 4–5, family 6 slots 6–7 |
| Mask | zone A `mask.png` reused (placement only). No new mask cook |
| Cutouts | none (`details: []`) |
| Height | min −0.965 m, max 2.263 m |
| 20 m span | 2.001 m (limit 3 m) |
| Slope | 14.50°, cells over 15° = 0 |
| Spawn | (4, −14), heading 255° |
| Boot `groundInfo` | tris 77500, sparse-sample maxSlope 0.326 rad |

Known this step: the chase and the wide shot still read as one tile period (TILE cannot grow; ground mag 0.87–0.91). Family weights are in the mesh. No standing cards.

**Step 1b (2026-10-04) — IN TEST.** Same relief numbers. The ground mesh adds a skirt to 480 m (18 rings, 96 segments) in the same draw. The sky shell sits at 640 m with clip far 720 m, so the skirt is in front of the shell. Ground tile is 1.42 m (`TILE` in `field.js`, `tile_m` in `clearing.json`). Three yaw-locked butte cards, black-keyed from their own pixels, seated outside the walk radius: heights 16.0 m, 7.062 m, 10.463 m (`packs/zone-b/src/buttes/`). An in-place 370° turn after that tile change measured ground mag 0.976 at heading 205. The chase at heading 255 shows the 16 m card breaking the skyline. The wide pose still shows a dark band under the painted land line. Cards at headings 75 and 180 still read above the ground line. Micro cutouts are still none (`details: []`). The body still stops at `contain()`, inside the cards, so the cards are not the collider.

**Step 1c (2026-10-04) — IN TEST.** Walk relief is unchanged (`heightAt` still the step 1 function; span and slope were not remeasured). Outside the rim the skirt rises 42 m by 480 m (`SKIRT_LIFT` in `field.js`). The ground shader mixes 0.40 of the way toward the one fog colour sampled from the horizon, then the alpha falls from 1 to 0 between 300 m and 460 m over the sky already drawn. Butte cards add `skirtLift` at their base. On the wide pose `lookAt([-40,18,-24],[6,1,14])` the old luma cliff (35 at row 358) is gone; the largest 8-row jump in the new wide JPEG is 3.5, at the bottom of the frame. The chase pose still shows a far edge (luma jump −16.8 at row 546). Micro cutouts are still none.

### 11. How B and C would fill the template (material ideas only; words go to their local file)

| Role | B Ember Mesa (`ember-mesa`, golden hour) | C Cascade Verdance (`cascade-verdance`, morning) |
|---|---|---|
| Ridges / high | layered sandstone slabs with eroded ledges and grit in the joints | rock outcrop plates with moss packed in the cracks |
| Hollows | packed desert grit with wind ripples and small pebbles | gravel streambed with rounded wet pebbles and silt |
| Flats (default) | cracked dried-clay polygons with curled edges | short dense turf with small stones and clover patches |
| Crack / channel bands | scree of broken rock chips along dry gullies | trickle runnels: wet slate with raised moss lips |
| Cutouts (≤ 30 cm) | pebble cluster, dry scrub tuft, small broken ledge | grass tuft, fern sprig, moss-capped pebble |

Same T1–T4 text; only `{FAMILY_MATERIAL}`, `{CUTOUT_SUBJECT}` and the kit slots change. Keep the four relief roles.

## 12. Make the ground for a new biome — files

1. Copy `packs/zone-a/play/{index.html,play.js,hullmesh.js,terrain.js,field.js}`, `packs/zone-a/clearing.json`,
   `packs/zone-a/src/terrain/{prep.py,qc.mjs}` to `packs/<zone>/…` (replace `zone-a` paths in `clearing.json`,
   `prep.py` `GROUND`/`DETAIL`, `qc.mjs` third argument).
2. Change: the local material file (Part 1 §1); `prep.py` `TILES/MASK/CUTS` maps + key limits; `field.js` footprint
   (area, harmonics), macro features (inside ≤ 3 m / σ ≥ 2.27·A), `familyAt` thresholds, `MICRO`, `TILE` (§6 formula);
   `terrain.js` card sizes/rules if the cutouts differ; `clearing.json` spawn, sky slices, ground lists.
3. Do not change: the T1–T4 frames, prep maths, mesh method, filtering, post constants (except one grade per biome), QC rows.
4. Run §9; fill a recipe (`learn/recipes/`), failures, take note; new approved method → METHOD.md + decisions log.

Zone B (2026-10-04) kept that copy under `packs/zone-b/play/` and read the zone directory, the kit `post` block, and the sky file list from `clearing.json` / `sky.json`. `packs/zone-a` was not edited. The copied `qc.mjs` takes the zone directory as its third argument. `prep.py` in the copy does not rebuild the mask and does not cut cards.

## 13. Known issues still to fix (targets)

Measured 2026-10-03 on the PR #156 head (`groundInfo` = boot log; QC = `qc.mjs`, walkable cells, 2 m baseline).

| Issue | Now | Target | Cause / fix direction |
|---|---|---|---|
| **Relief too tall / steep** — owner accepted for now | Boot: max **7.66 m** (−1.74…7.66, mesh incl. rim), max slope **0.639 = 33°** (0.45 m baseline incl. micro). QC: walkable −1.80…5.43 m, **5.20 m** span in a 20 m window, interior max **25.3°**, rim berm **51°**, **21 %** of cells > 15° | **≤ 3 m over ≥ 20 m, slope ≤ 15°** | Crest 6.4 m on σ 8.5 m and rim berm +2.6 m in ~6 m. Scale every feature to A ≤ 3 m with σ ≥ 2.27·A; make the crest a gentle rise (the landmark brings the height as an object); replace the berm by a soft rise or boundary objects. Re-run QC until both relief rows PASS. |
| **Hard material edges** | `familyAt` per vertex, `flat` attribute → stepped contours along triangles | **Soft transitions made of Imagine pixels** | Never a code gradient. Options: per-vertex relief weight compared with an Imagine mask value (the boundary takes the mask's organic shape over a band), or Imagine transition tiles (`image_edit` of two family tiles into a blend). |
| **Tile grid in wide views** | 1.45 m period readable in q8–q10 (and the 8.5 m mask repeats) | **No visible grid in wide views** | More variants per family with a world-hashed slot per cell (placement), a second, larger Imagine mask (~40–60 m) between variants, fog. TILE cannot grow (mag 0.912). |
| **Flat cap above the sky** | q2 rim / crest: flat colour above the frame top | **No flat cap** | Sky ring is a fixed 90 m cylinder sized for eye 1.22 m on flat ground; relief lifts the eye to ~9 m, the frame top passes over the ring and shows clear colour + fog (a code-coloured pixel). Fix in the sky step: ring height / placement from eye height; the 3 m relief cap also shrinks it. |
| m7 duplicate | m7 = m6 (429) | 2 real slots per family | Redo T2 for family 6 (exact text in the local file). |
| Micro relief sampling | 0.435 m vertex step reaches only the low frequencies of `h`; micro uses slot `fam` only, not the mask mix | Painted cracks visibly raised | Denser mesh near paths within the phone budget; mix `h[fam]`/`h[fam+1]` with the mask like the albedo. |
| Misc | Coarse rim silhouette in the overview; a few cards read as chunks; fog also reaches the sky at its 0.58 cap; `07-wide-412` = `02-wide` (canvas locked 720×1600); kit preamble not pasted | — | Track in the next ground step. |

## 14. Provenance and what is not recoverable

- Exact prompts, call ids, still → slot map, sha256: local file + `provenance.json` (paths at the top). Run log:
  `/workspace/grokcli/logs/20261003-094317-zoneA.ndjson`.
- Imagine has no seed: new calls give new pixels. Exact reproduction is from the saved stills (session folder + backup).
- Not in the log: any Imagine parameter other than `aspect_ratio` (the 429 names model `grok-imagine-image-quality`); the
  first-pass proof scripts lived in `/tmp` (poses kept in §9); `tools/assetcheck` was not run on this set.

Self-check (2026-10-03): following only this page, a fresh reader can rebuild zone A (§9, verified byte-identical) and make
another biome (§1–§7, §11–§12); exact zone A strings need the local file, by law.
