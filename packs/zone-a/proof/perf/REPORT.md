# Zone A performance pass

Verdict: PASS

Date: 2026-10-04. Branch `archives-shards`. Imagine calls: 0.

Phone caps for this step: drawCalls ≤ 12, texMB ≤ 260 with `texture_mem` PASS (256 MiB), active videos ≤ 4, pack ≤ 150 MB. Law 65: waste only. Spawn magnification stays 0.998.

## Done when

| Row | Result |
| --- | --- |
| Spawn chase, 720×1600 | drawCalls 12, texMB 254.370, activeVideos 4, mag 0.998 |
| Gate film frame | No `gates` in `clearing.json`. Spawn is the peak. Every walk sample stayed at 12 draws and 266725876 texture bytes |
| Magnification on the spawn chase | 0.998188 (sky upper). Horizon 0.991868. High 0.992507. Bolt 0.459 |
| Root `npm test` | PASS, exit 0 |
| `tools/playcheck` `npm test` | PASS, 51 tests, 0 fail |
| Stills | `spawn-chase.png` and `menu-open.png`, both 720×1600 |

## Measured

Baseline before this pass (same page, spawn): drawCalls 14, textureBytes 296020714 (282.312 MiB), activeVideos 4, presented mag 0.998188, jsMs about 44.9 on one SwiftShader snapshot.

After, live `tools/playcheck/run` at 360×800 CSS, DPR 2 (`--no-video`, `--layout packs/zone-a/clearing.json`):

`Perf: drawCalls=12, texMB=254.370, activeVideos=4, jsMs=26.5`

`texture_mem` PASS (266725876 ≤ 268435456). `active_videos` PASS. `draw_calls` PASS (peak 12, tool cap 150). `fullscreen` PASS. `backdrop_res` PASS. `webgl_errors` 0. Pack `du -sb packs/zone-a` = 105218925 bytes (100.3 MiB).

Spawn probe, same pixels: canvas 720×1600, state IDLE at (−6, −14), heading 32°, jsMs 25.10 on that snapshot. Draw split: hulls 2, rocks 1, ruins 1, terrain 2, archives 1, and the sky dome plus one instanced sky-video draw, total 12.

## What was removed

Three sky video layers (stars, dust, meteor-nebula) are one `drawArraysInstanced`. Gains, keys, and the meteor window are the same. A layer with gain 0 discards in the shader.

Opaque images that the shaders sample as `.rgb` upload as RGB8: ground, zenith, arch, wreck skins, and the post colour targets. Gate skin 0 stays RGBA (`alpha.png`). Detail cutouts are three textures with no array padding. The micro atlas is a 1:1 shelf repack (`imageSmoothing` false); `features.png` was already full and was left. Horizon and high bands were scaled only where the source was past a 0.993 magnification cap, after the existing width fit. The upper band was not scaled.

Bolt, hull views, the crystal, the mask, and ground `srcW` were not resized. Menu pause of sky, gate, and Bolt was not changed. No Imagine file was rewritten.

## Playcheck rows outside this budget

The circle walk exits 1. This clearing is relief schema `clearing/1` with no gates and no fog band, so `gate`, `fog_band`, `ring_closed`, `stops_visible`, and `collider_eq_visual` fail on that walk. `mag_max` is 1.644 at `04-stop-270`. Spawn stays 0.998. The bands this pass scaled stay under 0.993. Rock, feature, and Bolt source sizes were not changed.

`render_source` reports 5 findings that were already in the load path: `terrain.js` depth attachment uses `NEAREST` (DEPTH_COMPONENT24, not a world colour texture), and three `bufferData(new TypedArray)` calls are one-time `STATIC_DRAW` (ground quad, ground index, rock quad). Depth filtering was left as it is. Note: `feedback/2026-10-04-playcheck-depth-nearest.md`.

## Stills

| Shot | Path |
| --- | --- |
| Spawn chase | `/workspace/grokcli/out/zoneA-perf/spawn-chase.png` |
| Menu open (Resume, Archives, Citadel, Settings, hall film) | `/workspace/grokcli/out/zoneA-perf/menu-open.png` |

Playcheck report: `/tmp/zone-a-playcheck/report.md`.
