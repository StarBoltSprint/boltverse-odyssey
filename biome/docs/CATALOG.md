# Catalog (not laws)

Pages here are **optional**. They are **not** cook gates. Default Bolt remains empty Video A + GPU keyed cycle ([10](10-bolt-cutout-law.md) · [15](15-gpu-compositor.md) · [00](00-PRIORITY0-any-biome.md)). GPU is the product for a 10-plate `m` sprint. Native is a hero-shot lab.

| Page | Status |
|---|---|
| [27-native-road-slide.md](27-native-road-slide.md) | OPTIONAL lab note. Use only if the player explicitly asks. Cold Grok must not switch a biome to this. Hole = center dashes under native Bolt; finish only if dashes never sit under paws + baked matte. |

## Laws added after 27 (cook gates, not catalog)

| Page | Gate |
|---|---|
| [28-stills-two-rails.md](28-stills-two-rails.md) | Décor snowballs. Events swap. Last never `@`. |
| [29-imagine-compiler.md](29-imagine-compiler.md) | Imagine bakes the world. Player plays. Still = truth. |
| [30-i2i-prompt.md](30-i2i-prompt.md) | Numbered refs. One delta. IGNORE crop. |
| [31-light-lock.md](31-light-lock.md) | KEEP exposure bible. Practicals vs event flash. |
| [32-howl-gpu-targets.md](32-howl-gpu-targets.md) | Rail B keyed Howl targets. Shatter per type. REUSE Howl KEEP. |
| [33-plate-mae-qc.md](33-plate-mae-qc.md) | last(N) vs first(N+1) before hang. |
| [34-howl-live-aim.md](34-howl-live-aim.md) | Howl distance / cut-on-contact / shatter swap / wet GPU. Copy `scripts/howl-live/`. |
| [35-lane-materials.md](35-lane-materials.md) | Lane material menu A–D before P0 stills. Ban grey concrete as silent default. |
| [36-gpu-zones-lena-procedural.md](36-gpu-zones-lena-procedural.md) | GPU zones = keyed layers over densify. Runtime `scripts/lena-lod/lenaLod.js`. Bib: [COLD_START-lena-bib.md](COLD_START-lena-bib.md). |
| [37-path-beat.md](37-path-beat.md) | Path beat. Chemin reveals one lane ~3 s ahead. Runtime `scripts/path-beat/pathBeat.js`. Paste: [COLD_START-path-beat.md](COLD_START-path-beat.md). |
| [38-gpu-light-openable.md](38-gpu-light-openable.md) | GPU light layers + openables. Light-only plates and closed/open/transition. Runtime `scripts/gpu-light/` · `scripts/gpu-openable/`. Paste: [COLD_START-gpu-light-openable.md](COLD_START-gpu-light-openable.md). |

**Any new biome convo — playable composite (lane, glance, wings, foes, howl), any paint:** paste [COLD_START-biome-method.md](COLD_START-biome-method.md) first. Section A is the road densify. Section B is the forest / open-ground world cook (black → sky → ground → horizon → GPU), inline. Worked example: [pyre/METHOD.md](../../pyre/METHOD.md) (Diablo road only). Forest numbers and shaders: [43-open-ground.md](43-open-ground.md), [COLD_START-open-ground.md](COLD_START-open-ground.md), [pyre/GROVE.md](../../pyre/GROVE.md). Room look: [pyre/ORBIT.md](../../pyre/ORBIT.md). Plain / Thunderwolf: [pyre/PLATE.md](../../pyre/PLATE.md) and METHOD sections 11–13. There is no `pyre/PLAIN.md` or `pyre/VISTA.md`. From this folder the Pyre files are `../../pyre/…`.

**Densify and Imagine Live keyed props** (laws 39–42) still paste [COLD_START-imagine-engine.md](COLD_START-imagine-engine.md). That paste does not replace the composite method above.

| Page | Gate |
|---|---|
| [39-imagine-live-light.md](39-imagine-live-light.md) | Prop is an Imagine video filmed in the plate light. Clean luma key, no regrade. Tap fires howl. Runtime `scripts/imagine-live/imagineLive.js`. Paste: [COLD_START-imagine-live.md](COLD_START-imagine-live.md). |
| [40-nebula-cycle.md](40-nebula-cycle.md) | Nebula Lane: nebula → shore → disk → eclipse. 30 s hold + 3.2 s fade. Continue from the last frame. Trim the slow head. Paste: [COLD_START-nebula-lane.md](COLD_START-nebula-lane.md). |
| [41-eclipse-look.md](41-eclipse-look.md) | Hidden 3D yaw, eclipse only. Videos stay videos. Drag looks, tap changes lane. Planet cards + star sky. Runtime `scripts/eclipse-look/eclipseLook.js`. Paste: [COLD_START-nebula-lane.md](COLD_START-nebula-lane.md). |
| [42-shoulder-panorama.md](42-shoulder-panorama.md) | Any already-cooked biome. Three videos, not yaw. Flick changes lane, a 150 ms hold looks, the outer flick boards one luminous path. Path scrolls only while boarded. No fog veil, no offline stitch. Runtime `scripts/shoulder-panorama/shoulderPanorama.js`. Paste: [COLD_START-shoulder-panorama.md](COLD_START-shoulder-panorama.md). |
| [43-open-ground.md](43-open-ground.md) | Open ground, no lane. Four locked skies, one tiling ground, GPU Bolt. Horizon grain is 0 inside the depth clamp, so no vertical dirt strokes. Not plate-geo-qc. Script `scripts/open-ground/earth_color.py`. World-cook order: section B of [COLD_START-biome-method.md](COLD_START-biome-method.md). Numbers: [COLD_START-open-ground.md](COLD_START-open-ground.md). |
| [44-imagine-volume-stack.md](44-imagine-volume-stack.md) | Imagine volume on that ground. Two jobs: collision capsule from the spawn row, and look (parallax + occlusion + scale) from keyed cards in meters. LOD bands in [`../scripts/jade-lod/`](../scripts/jade-lod/README.md) pick how much twin as you close in. Resting cards are cutout; blend only on a band change, cap 8 ([`fade.ts`](../scripts/jade-lod/fade.ts)). The capsule never fades. Extends Grove simplex placement. Does not replace it. 8-bole test is the remix Done-when. |
| [45-shader-graph-look-kitchen.md](45-shader-graph-look-kitchen.md) | Shader graph shades a card or plate the CPU already posed. Sample, fade alpha, cutout, premultiply, mist. Yaw is `billboardYaw`. meshLod is `holdBand`. The capsule stays the occupancy grid. Two instances: mask at rest, translucent for ≤8 fades. |
| [46-four-picture-jobs.md](46-four-picture-jobs.md) | Four picture jobs on the same seed: Imagine sheets, ground/sky plates, a two-plane tree, height as posture only. Capsule stays on the bole. The sol film stays flat. Stubs in [`../scripts/jade-lod/`](../scripts/jade-lod/README.md). |
| [47-jade-sheet-cook.md](47-jade-sheet-cook.md) | Sheet cook. Cutouts, not places. One subject on empty air in `public/decor/jade/sheets/`. Prompts in [`../scripts/jade-lod/SHEETS.md`](../scripts/jade-lod/SHEETS.md). Lookup `TEX.bole[2].bole / .crown / .imp`. Missing file falls back to v0. |

**Look left on a biome you already cooked:** read [COLD_START-shoulder-panorama.md](COLD_START-shoulder-panorama.md).

**Nebula Lane, a new convo:** read [COLD_START-nebula-lane.md](COLD_START-nebula-lane.md) before cooking.

**Open ground (forest, dirt plain, no road):** the world-cook order is section B of [COLD_START-biome-method.md](COLD_START-biome-method.md). Numbers and shaders: [COLD_START-open-ground.md](COLD_START-open-ground.md) and [43-open-ground.md](43-open-ground.md). Do not run `plate-geo-qc.py`. Four-face grove trees are the next step in [pyre/GROVE.md](../../pyre/GROVE.md), not a v1 KEEP. Volume on that ground is [44-imagine-volume-stack.md](44-imagine-volume-stack.md) (capsule + cards). Card shading is [45-shader-graph-look-kitchen.md](45-shader-graph-look-kitchen.md). Picture jobs are [46-four-picture-jobs.md](46-four-picture-jobs.md). Sheet cook is [47-jade-sheet-cook.md](47-jade-sheet-cook.md). Do not invent a second law 43.

**Playable composite, any paint:** [COLD_START-biome-method.md](COLD_START-biome-method.md). Not a law number. Law 43 stays open ground. Law 44 stays the volume stack. Law 45 stays the shader-graph look kitchen. Law 46 stays the four picture jobs. Law 47 stays the Jade sheet cook.
