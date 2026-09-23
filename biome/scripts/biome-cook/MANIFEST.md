# MANIFEST — biome cook scripts and laws

Inventory only. Hang ≠ wipe. `biome-cook.sh` wraps these entries. It does not replace their math.

## Script directories

| Dir | Law | Entry | Role |
|---|---|---|---|
| [`biome/scripts/biome-cook/`](.) | entry | [`biome-cook.sh`](biome-cook.sh) · [`README.md`](README.md) | Ordered kit. Prints steps 1→17. Invokes the rows below. |
| [`biome/scripts/plate-geo-qc/`](../plate-geo-qc/) | 23 | [`plate-geo-qc.py`](../plate-geo-qc/plate-geo-qc.py) | 1-point / lock-off / sag. PASS before hang. |
| [`biome/scripts/plate-hazard-qc/`](../plate-hazard-qc/) | 25 | [`plate-hazard-qc.py`](../plate-hazard-qc/plate-hazard-qc.py) | Hazard on the cone. `--expect 0\|1\|2`. |
| [`biome/scripts/plate-mae-qc/`](../plate-mae-qc/) | 33 | [`plate-mae-qc.py`](../plate-mae-qc/plate-mae-qc.py) | Last frame N vs first N+1. Exit non-zero = FAIL. |
| [`biome/scripts/bolt-scale/`](../bolt-scale/) | 13d | [`boltScale.js`](../bolt-scale/boltScale.js) · [`demo.js`](../bolt-scale/demo.js) | `computeScale` / `assertScale`. |
| [`biome/scripts/gallop-clock/`](../gallop-clock/) | 14c | [`gallopClock.js`](../gallop-clock/gallopClock.js) · [`demo.js`](../gallop-clock/demo.js) | Native 96 fps. Phase from `plate_time`. |
| [`biome/scripts/chroma-despill/`](../chroma-despill/) | 13c | [`vectorDespill.js`](../chroma-despill/vectorDespill.js) · [`demo.js`](../chroma-despill/demo.js) | Vector despill after key, before grade. |
| [`biome/scripts/curvature-sample/`](../curvature-sample/) | 12 · 12b | [`curvatureSample.js`](../curvature-sample/curvatureSample.js) · [`demo.js`](../curvature-sample/demo.js) | `resamplePath` → `path.json`. |
| [`biome/scripts/bolt-key-gl/`](../bolt-key-gl/) | 15 · 17 · 22 | [`bolt-key-gl.ts`](../bolt-key-gl/bolt-key-gl.ts) · [`wet-fx.ts`](../bolt-key-gl/wet-fx.ts) · [`WIRE.md`](../bolt-key-gl/WIRE.md) | GPU compositor. `GPU_VER = 24`. Copy both sources. |
| [`biome/scripts/howl-live/`](../howl-live/) | **34** | [`howlLive.js`](../howl-live/howlLive.js) · [`howlWet.glsl`](../howl-live/howlWet.glsl) · [`demo.js`](../howl-live/demo.js) | `howlFireSec`, `howlFxBeam`, cut-on-contact, shatter swap, wet GPU. |
| [`biome/scripts/lena-lod/`](../lena-lod/) | **36** | [`lenaLod.js`](../lena-lod/lenaLod.js) · [`demo.js`](../lena-lod/demo.js) | `lenaFrame`, far/mid/near bands, bib preload. Cone = howlPose. |

`bolt-key-gl-scissor-prev.ts` lives in `bolt-key-gl/` as **ARCHIVE**. Copying it is FAIL (vertical bars, eaten paws). It is not a cook step.

Every file currently hung under those dirs:

| Path |
|---|
| `biome/scripts/biome-cook/README.md` |
| `biome/scripts/biome-cook/COLD_START-biome-cook.md` |
| `biome/docs/COLD_START-biome-cook.md` (same paste) |
| `biome/scripts/biome-cook/MANIFEST.md` |
| `biome/scripts/biome-cook/biome-cook.sh` |
| `biome/scripts/plate-geo-qc/README.md` |
| `biome/scripts/plate-geo-qc/plate-geo-qc.py` |
| `biome/scripts/plate-hazard-qc/README.md` |
| `biome/scripts/plate-hazard-qc/plate-hazard-qc.py` |
| `biome/scripts/plate-mae-qc/README.md` |
| `biome/scripts/plate-mae-qc/plate-mae-qc.py` |
| `biome/scripts/bolt-scale/README.md` |
| `biome/scripts/bolt-scale/package.json` |
| `biome/scripts/bolt-scale/boltScale.js` |
| `biome/scripts/bolt-scale/demo.js` |
| `biome/scripts/gallop-clock/README.md` |
| `biome/scripts/gallop-clock/package.json` |
| `biome/scripts/gallop-clock/gallopClock.js` |
| `biome/scripts/gallop-clock/demo.js` |
| `biome/scripts/chroma-despill/README.md` |
| `biome/scripts/chroma-despill/package.json` |
| `biome/scripts/chroma-despill/vectorDespill.js` |
| `biome/scripts/chroma-despill/demo.js` |
| `biome/scripts/curvature-sample/README.md` |
| `biome/scripts/curvature-sample/package.json` |
| `biome/scripts/curvature-sample/curvatureSample.js` |
| `biome/scripts/curvature-sample/demo.js` |
| `biome/scripts/bolt-key-gl/README.md` |
| `biome/scripts/bolt-key-gl/WIRE.md` |
| `biome/scripts/bolt-key-gl/bolt-key-gl.ts` |
| `biome/scripts/bolt-key-gl/wet-fx.ts` |
| `biome/scripts/bolt-key-gl/bolt-key-gl-scissor-prev.ts` (ARCHIVE / FAIL to copy) |
| `biome/scripts/howl-live/README.md` |
| `biome/scripts/howl-live/package.json` |
| `biome/scripts/howl-live/howlLive.js` |
| `biome/scripts/howl-live/howlWet.glsl` |
| `biome/scripts/howl-live/demo.js` |
| `biome/scripts/lena-lod/README.md` |
| `biome/scripts/lena-lod/package.json` |
| `biome/scripts/lena-lod/lenaLod.js` |
| `biome/scripts/lena-lod/demo.js` |

## Laws used for a biome cook

| Law | Doc | Script or asset |
|---|---|---|
| 13b | [`biome/docs/13b-anti-sticker-contact.md`](../../docs/13b-anti-sticker-contact.md) | contact in [`bolt-key-gl.ts`](../bolt-key-gl/bolt-key-gl.ts) (no separate dir) |
| 13c | [`biome/docs/13c-green-despill.md`](../../docs/13c-green-despill.md) | [`chroma-despill/`](../chroma-despill/) |
| 13d | [`biome/docs/13d-auto-scale.md`](../../docs/13d-auto-scale.md) | [`bolt-scale/`](../bolt-scale/) |
| 14c | [`biome/docs/14c-gallop-clock.md`](../../docs/14c-gallop-clock.md) | [`gallop-clock/`](../gallop-clock/) |
| 15 | [`biome/docs/15-gpu-compositor.md`](../../docs/15-gpu-compositor.md) | [`bolt-key-gl/`](../bolt-key-gl/) |
| 16 | [`biome/docs/16-biome-ground-fx.md`](../../docs/16-biome-ground-fx.md) | [`wet-fx.ts`](../bolt-key-gl/wet-fx.ts) |
| 17 | [`biome/docs/17-live-compositor.md`](../../docs/17-live-compositor.md) | [`bolt-key-gl/`](../bolt-key-gl/) · [`WIRE.md`](../bolt-key-gl/WIRE.md) |
| 20 | [`biome/docs/20-default-plate-proportions.md`](../../docs/20-default-plate-proportions.md) | frame measures · [`image-empty-plate.txt`](../../prompts/image-empty-plate.txt) `{LANE_MATERIAL}` |
| 20b | [`biome/docs/20b-frost-aurora-proportions.md`](../../docs/20b-frost-aurora-proportions.md) | Frost picture example of law 20. Not the default paint. |
| 22 | [`biome/docs/22-gpu24-frost-keep.md`](../../docs/22-gpu24-frost-keep.md) | `GPU_VER = 24` in [`bolt-key-gl.ts`](../bolt-key-gl/bolt-key-gl.ts) |
| 22-m | [`biome/docs/22-m-densify-snowball.md`](../../docs/22-m-densify-snowball.md) | [`snowball-refs.txt`](../../prompts/snowball-refs.txt). Not the GPU-22 file. |
| 23 | [`biome/docs/23-plate-geo-qc.md`](../../docs/23-plate-geo-qc.md) | [`plate-geo-qc.py`](../plate-geo-qc/plate-geo-qc.py) |
| 24 | [`biome/docs/24-camera-1point.md`](../../docs/24-camera-1point.md) | [`camera-1point.txt`](../../prompts/camera-1point.txt) |
| 25 | [`biome/docs/25-hazard-cone.md`](../../docs/25-hazard-cone.md) | [`plate-hazard-qc.py`](../plate-hazard-qc/plate-hazard-qc.py) |
| 26 | [`biome/docs/26-biome-sprint-plan.md`](../../docs/26-biome-sprint-plan.md) | plans: [`frost-sprint.md`](../../docs/plans/frost-sprint.md) · [`prismwake-sprint.md`](../../docs/plans/prismwake-sprint.md) · [`cometwake-sprint.md`](../../docs/plans/cometwake-sprint.md) |
| 27 | [`biome/docs/27-native-road-slide.md`](../../docs/27-native-road-slide.md) | Optional catalog. Not a default cook step. No script. |
| 28 | [`biome/docs/28-stills-two-rails.md`](../../docs/28-stills-two-rails.md) | stills law. No script. |
| 29 | [`biome/docs/29-imagine-compiler.md`](../../docs/29-imagine-compiler.md) | Imagine bakes. Seam judge is law 33. |
| 30 | [`biome/docs/30-i2i-prompt.md`](../../docs/30-i2i-prompt.md) | numbered refs, one delta. No script. |
| 31 | [`biome/docs/31-light-lock.md`](../../docs/31-light-lock.md) | persistent vs event. Seam WB is law 33. |
| 32 | [`biome/docs/32-howl-gpu-targets.md`](../../docs/32-howl-gpu-targets.md) | KEEP below · [`howl-obstacle.txt`](../../prompts/howl-obstacle.txt) · [`howl-shatter.txt`](../../prompts/howl-shatter.txt) |
| 33 | [`biome/docs/33-plate-mae-qc.md`](../../docs/33-plate-mae-qc.md) | [`plate-mae-qc.py`](../plate-mae-qc/plate-mae-qc.py) |
| 34 | [`biome/docs/34-howl-live-aim.md`](../../docs/34-howl-live-aim.md) | [`howl-live/`](../howl-live/) — step 14 |
| 35 | [`biome/docs/35-lane-materials.md`](../../docs/35-lane-materials.md) | step 3, before the empty still. Menu A–D. Paste [`COLD_START-lane-materials.md`](../../docs/COLD_START-lane-materials.md). No script. |
| 36 | [`biome/docs/36-gpu-zones-lena-procedural.md`](../../docs/36-gpu-zones-lena-procedural.md) | before empty stills and Video A. Keyed GPU layers over densify. Runtime [`lena-lod/`](../lena-lod/). Paste [`COLD_START-gpu-zones.md`](../../docs/COLD_START-gpu-zones.md) · [`COLD_START-lena-bib.md`](../../docs/COLD_START-lena-bib.md). |

## Howl KEEP

| Asset | Laws | Rule |
|---|---|---|
| [`biome/fx/howl/howl-attack.mp4`](../../fx/howl/howl-attack.mp4) | 32 · 34 | SmiR KEEP. REUSE on every biome. Do not recook. Do not shader the rings. Width and speed tune in Live. |
