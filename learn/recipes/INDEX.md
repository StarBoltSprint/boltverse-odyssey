# Recipe index

Filled recipes live in this directory, one file per validated cook, copied from [`_template.md`](_template.md). Add the row when the file is added. Do not list a cook whose prompt or QC numbers were not stored.

Filled so far: take 10d hero ship and slab rock (below). The methods below are the docs and commands a new cook follows until a recipe file exists. They are not recipes: several of them say the prompt was not stored.

Skills: [`.grok/skills/`](../../.grok/skills/). Failures already paid for: [`../failures.md`](../failures.md). Image geometry (horizon, slices, turnaround, sun, scale, texel density) is [`../geometry.md`](../geometry.md). That page is a lock, not a recipe. No cook was stored for it.

## sky

| Recipe | Commit | QC |
| --- | --- | --- |
| [zone-a-sky-ring.md](zone-a-sky-ring.md) — three-band outpaint ring, instanced living tiles (prompt text stays in the untracked provenance) | `25dd00d` | horizon mag 0.982; video tile mag 0.792; play mag_max 0.982 |

Chained slices, not one wide file: [`biome/docs/64-imagine-build-limits.md`](../../biome/docs/64-imagine-build-limits.md) section D (generate slice 1 at 21:9 or 5:2, each next slice an edit of the previous, `required_px = play_width / (hfov_deg / 360)`). The chain gate, the living-loop period, and the perceived-repetition row are the sky skill ([`.grok/skills/sky-panorama/SKILL.md`](../../.grok/skills/sky-panorama/SKILL.md)) and `python3 tools/sky/check.py`. Kind `backdrop` is still `python3 tools/assetcheck/check.py` ([`tools/assetcheck/README.md`](../../tools/assetcheck/README.md)). The 138° KEEP outpaint and the overlap MAE band are [`tools/relief/README.md`](../../tools/relief/README.md) and [`biome/docs/60-imagine-relief-panorama-method.md`](../../biome/docs/60-imagine-relief-panorama-method.md). Plate-0 prompt: not stored in the repo. The step 2b ring prompt text is in the untracked provenance file named by the recipe.

## ground-tile

| Recipe | Commit | QC |
| --- | --- | --- |
| [zone-a-relief-mesh.md](zone-a-relief-mesh.md) — irregular relief mesh, eight still slots, per-image depth, low cards (prompt not stored in the tracked file) | `6afb2a2` | seam ratio 0.000; walk mag_max 0.912; proof mag 0.910 |

World-locked top-down stills, about **0.90 m**, **≥ 4** variants: [`biome/docs/61-free-clearing-walk.md`](../../biome/docs/61-free-clearing-walk.md), [`biome/docs/62-open-world-zones-process.md`](../../biome/docs/62-open-world-zones-process.md). This step used **1.45 m**. The phone mag row still passed. Gate the set together: `python3 tools/assetcheck/check.py` kind `tile` (wrap seam, exposure, magnification ≤ 1 at 720×1600). Placement is `python3 tools/layout/layout.py generate` then `layout.py check`. The layout tool does not draw the tile.

## rock

| Recipe | Commit | QC |
| --- | --- | --- |
| [rock-slab-overhang.md](rock-slab-overhang.md) — grey slate slab with an overhang (owner-approved still; orbit only partly validated) | `c4436f2` (local `cli/take10d`) | natural-rock circ 0.464–0.633, bg/fringe/holes clean; objsheet keep 0.452/0.377 FAIL |
| [zone-a-rocks.md](zone-a-rocks.md) — kit-driven boulder and stone hulls plus pebble cutouts (prompt text stays in the untracked provenance; crest not shipped) | `5aae7e0` | boulder walkaround mag 0.990; stone mag 0.989; chase mag 0.998 |

Eight views, one every 45°, from one sharp still (V0) plus the previous view: [`biome/docs/60-imagine-relief-panorama-method.md`](../../biome/docs/60-imagine-relief-panorama-method.md) KEEP method. Eight consistent views are not an Imagine feature (max 5 sources): [`biome/docs/64-imagine-build-limits.md`](../../biome/docs/64-imagine-build-limits.md) section C. Before a hull: `python3 tools/assetcheck/check.py` kind `cutout`, then `python3 tools/objsheet/sheet.py`.

## ruin

| Recipe | Commit | QC |
| --- | --- | --- |
| [zone-a-ruins.md](zone-a-ruins.md) — kit-driven gate loft plus a reused Howl wreck (prompt text stays in the untracked local file) | `f247ee3` | gate texels/m 155.81, approach 11.508 m; wreck texels/m 160.07, approach 11.201 m; play frame mag 0.998 |
| [zone-a-gate-monolith.md](zone-a-gate-monolith.md) — 28 m corridor gate, one atlas, mesh-edge walls (prompt text stays untracked). Step 4 arch numbers above are retired. | `6e5ddf0` | height 28 m, opening 7.314 m, approach 48.932 m, worst close-up mag 14.99 |

One command: `python3 tools/ruins/build.py --kit <id>` then `python3 tools/ruins/selftest.py --kit <id>`. The Howl loft gate stays `python3 tools/hard-objects/rebuild.py`.

## hull-ship

| Recipe | Commit | QC |
| --- | --- | --- |
| [hull-ship-xai-starship-hero.md](hull-ship-xai-starship-hero.md) — black faceted starship, 18° camera, etched shield emblem (hero only; the orbit failed) | `0bb54c1` (local `cli/take10d`, wreck10 install) | margins ≥ 0.041, luma rel −0.005, emblem rows by eye |

Hull from stills that already passed the sheet: `python3 tools/walkaround/build.py --views <dir> --config <config.json> --out <dir>`. Read `qc/report.json`. Magnification ≤ 1. Register a passing object with `python3 tools/library/library.py add` so the next zone names `{ "library": "<id>" }` instead of recooking it ([`tools/library/README.md`](../../tools/library/README.md)).

## menu

| Recipe | Commit | QC |
| --- | --- | --- |
| [archives-menu-loop.md](archives-menu-loop.md) — one Imagine hall loop for every menu, paw glow by opacity (prompt not stored) | `a6d14e0` | seam MAE 1.8; mid MAE 9.986; 360×800 dpr 2 contain scale 1 |
| [archives-futurist-hall.md](archives-futurist-hall.md) — high-tech hall, ping-pong close, scale 1 on a tall phone (prompt not stored) | `2158259` | seam MAE 1.813; mid MAE 9.98; 640×1424 cover 1.125 contain scale 1 |

## cutout

| Recipe | Commit | QC |
| --- | --- | --- |
| — | — | — |

`python3 tools/assetcheck/check.py` kind `cutout` with a declared `onScreen` size and `key` (`alpha`, `black`, or `green`). Cook at or above the on-screen pixels. Compositor `scale` stays ≤ 1 ([`biome/docs/56-cutout-native-scale.md`](../../biome/docs/56-cutout-native-scale.md)). Bolt motion stays `lock/bolt-gallop-cycle.mp4`. An `assetcheck` WARN on a `lock/` file is not a recook.
