# biome-cook — ordered entry (read this first)

Cold Grok: follow **steps 1→17** only. Do not hunt `biome/docs/` first. Do not invent cook math. Do not rewrite script bodies. This folder **wraps and orders** what is already hung.

Hang ≠ wipe. Noun is biome-variable. Math is fixed. Pack auto-embed. Play URL hang = **Live only**, never a Build convo, never `grok.com/share`, never `/c/`.

Worked example (play URL only): https://boltboltverse-odyssey.grok.me

Paste: [`COLD_START-biome-cook.md`](COLD_START-biome-cook.md) · same text [`../../docs/COLD_START-biome-cook.md`](../../docs/COLD_START-biome-cook.md). Inventory: [`MANIFEST.md`](MANIFEST.md). Checklist: `bash biome/scripts/biome-cook/biome-cook.sh`.

Order matches [`../../docs/00-PRIORITY0-any-biome.md`](../../docs/00-PRIORITY0-any-biome.md) section C, plus laws through 35.

| # | Do | Law | Script |
|---|---|---|---|
| 1 | Show `lock/bolt-back.jpg` and `lock/bolt-gallop-cycle.mp4` in chat (teacher gate). REUSE the 6 s / 96 fps / 534-frame cycle. Do not invent a gallop. | [`biome/docs/10-bolt-cutout-law.md`](../../docs/10-bolt-cutout-law.md) · [`biome/docs/00-PRIORITY0-any-biome.md`](../../docs/00-PRIORITY0-any-biome.md) | — |
| 2 | Write the **10-plate sprint plan before d1**. Spine + beat / +1 / hazard / GPU Howl column. Cook in that order. | [`biome/docs/26-biome-sprint-plan.md`](../../docs/26-biome-sprint-plan.md) · plans: [`frost`](../../docs/plans/frost-sprint.md) · [`prismwake`](../../docs/plans/prismwake-sprint.md) · [`cometwake`](../../docs/plans/cometwake-sprint.md) | — |
| 3 | **Lane material first** (law 35 menu below), then empty still, first + distinct last, **ZERO dog**. Law 20 measures are the frame, not asphalt. Stills: décor snowballs, events swap (28). Imagine bakes the world (29). i2i = one delta (30). Light lock persistent vs event (31). | [`35`](../../docs/35-lane-materials.md) · [`20`](../../docs/20-default-plate-proportions.md) · [`28`](../../docs/28-stills-two-rails.md) · [`29`](../../docs/29-imagine-compiler.md) · [`30`](../../docs/30-i2i-prompt.md) · [`31`](../../docs/31-light-lock.md) | [`biome/prompts/image-empty-plate.txt`](../../prompts/image-empty-plate.txt) `{LANE_MATERIAL}` · paste [`COLD_START-lane-materials.md`](../../docs/COLD_START-lane-materials.md) |
| 4 | Next plate: success keeps the `@` stack and adds one ref (≤12). Miss drops one tier. d1+ has ≥1 spectacular hazard. | [`biome/docs/22-m-densify-snowball.md`](../../docs/22-m-densify-snowball.md) | [`biome/prompts/snowball-refs.txt`](../../prompts/snowball-refs.txt) |
| 5 | Video A. Extract last frame of the previous plate → that file **is** this plate’s `first` (P0: the empty first still). Cook the `last` still (advanced world, same camera). Imagine Video **first+last** — SuperGrok session (primary; no API key) **or** `imagineBiomeClip` when `XAI_API_KEY` is set. **48 fps**. Then `plate-mae-qc.py` on N vs N+1 (P0 has no previous seam). Missing key is not a stop. BAN one-still I2V, “forcé localement”, MAE PASS without the script. Frost: no `setpts` 2.7× warp. | [`biome/docs/02-videos.md`](../../docs/02-videos.md) · [`33`](../../docs/33-plate-mae-qc.md) · [`08`](../../docs/08-plate-speed.md) · [`20b`](../../docs/20b-frost-aurora-proportions.md) | [`biome/prompts/video-empty-plate.txt`](../../prompts/video-empty-plate.txt) · [`plate-mae-qc.py`](../plate-mae-qc/plate-mae-qc.py) |
| 6 | **Law 23 geo qc PASS** before hang. FAIL = recook. Camera block = conical 1-point lock-off (law 24). | [`23`](../../docs/23-plate-geo-qc.md) · [`24`](../../docs/24-camera-1point.md) | [`biome/scripts/plate-geo-qc/plate-geo-qc.py`](../plate-geo-qc/plate-geo-qc.py) · [`biome/prompts/camera-1point.txt`](../../prompts/camera-1point.txt) |
| 7 | REUSE lock cycle → key + vector despill (13c). Law 17 GPU even in cook QA. Steerable lane: `resamplePath` → `path.json` (12). | [`13c`](../../docs/13c-green-despill.md) · [`05`](../../docs/05-key.md) · [`12`](../../docs/12-lane-path-ribbon.md) · [`12b`](../../docs/12b-adaptive-curvature.md) · [`17`](../../docs/17-live-compositor.md) | [`biome/scripts/chroma-despill/`](../chroma-despill/) · [`biome/scripts/curvature-sample/`](../curvature-sample/) |
| 8 | `computeScale` / `assertScale`. Wide law-20 road: withersFrac ~0.10 is KEEP. Do not grow Bolt to fake 0.22. | [`biome/docs/13d-auto-scale.md`](../../docs/13d-auto-scale.md) | [`biome/scripts/bolt-scale/`](../bolt-scale/) |
| 9 | Wire Live: copy `bolt-key-gl.ts` **and** `wet-fx.ts`. `makeCompositor` **before** `getContext("2d")`. `GPU_VER = 24`. **FAIL** = `bolt-key-gl-scissor-prev.ts`. | [`15`](../../docs/15-gpu-compositor.md) · [`17`](../../docs/17-live-compositor.md) · [`22`](../../docs/22-gpu24-frost-keep.md) | [`biome/scripts/bolt-key-gl/bolt-key-gl.ts`](../bolt-key-gl/bolt-key-gl.ts) · [`wet-fx.ts`](../bolt-key-gl/wet-fx.ts) · [`WIRE.md`](../bolt-key-gl/WIRE.md) |
| 10 | `gallop-clock` / `assertGallopClock`. Native 96 fps, loop 1×, phase from `plate_time`. | [`biome/docs/14c-gallop-clock.md`](../../docs/14c-gallop-clock.md) | [`biome/scripts/gallop-clock/`](../gallop-clock/) |
| 11 | Plate IBL + neon-safe bounce (law 22) + dual-paw contact (13b) + biome FX row (16). No raw `mix(c, plate)`. No 5-tap body smear. | [`22`](../../docs/22-gpu24-frost-keep.md) · [`13b`](../../docs/13b-anti-sticker-contact.md) · [`16`](../../docs/16-biome-ground-fx.md) | [`biome/scripts/bolt-key-gl/wet-fx.ts`](../bolt-key-gl/wet-fx.ts) |
| 12 | Hazards: spawn far, 1–2 lanes. **Law 25** `plate-hazard-qc.py --expect 1` PASS before hang. Rail A is dodge, not destroyable. | [`biome/docs/25-hazard-cone.md`](../../docs/25-hazard-cone.md) | [`biome/scripts/plate-hazard-qc/plate-hazard-qc.py`](../plate-hazard-qc/plate-hazard-qc.py) |
| 13 | **Law 32** only when the sprint plan names a GPU Howl target. Keyed obstacle + per-type shatter. Howl attack = **REUSE** the KEEP mp4. Do not recook. Do not shader the rings. | [`biome/docs/32-howl-gpu-targets.md`](../../docs/32-howl-gpu-targets.md) | KEEP [`biome/fx/howl/howl-attack.mp4`](../../fx/howl/howl-attack.mp4) · [`howl-obstacle.txt`](../../prompts/howl-obstacle.txt) · [`howl-shatter.txt`](../../prompts/howl-shatter.txt) |
| 14 | **Law 34 HARD — Howl live aim.** Copy the script dir into Live. Trapezoid Bolt mouth → prop (inset tip). `howlFireSec`. `playbackRate = clipFront/fireSec`. **Pause Howl on contact** even if the mp4 remains. Swap that type’s shatter. Wet GPU = `howlWet.glsl` (not a new laser). | [`biome/docs/34-howl-live-aim.md`](../../docs/34-howl-live-aim.md) | [`biome/scripts/howl-live/howlLive.js`](../howl-live/howlLive.js) · [`howlWet.glsl`](../howl-live/howlWet.glsl) · [`demo.js`](../howl-live/demo.js) |
| 15 | **Law 33** seam PASS before hang of any plate after P0. Last frame N vs first frame N+1. Exit non-zero = recook. | [`biome/docs/33-plate-mae-qc.md`](../../docs/33-plate-mae-qc.md) | [`biome/scripts/plate-mae-qc/plate-mae-qc.py`](../plate-mae-qc/plate-mae-qc.py) |
| 16 | Hang ≠ wipe. ADD `road-<biome>*.mp4` beside canyon→cars→duel→night→war. Pack auto-embed. Bump `GPU_VER`. | [`09`](../../docs/09-recette-biome.md) · [`11`](../../docs/11-plate-order.md) · [`07`](../../docs/07-pack-live.md) | [`client/pack.js`](../../../client/pack.js) · `BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` |
| 17 | Smoke: dogFps ≈ min(96, display); hind paws intact; no vertical bars; no neon stripe through the torso; sharp interior; shadow on the road; FX on the plant; coat matches THIS plate. | [`biome/docs/00-PRIORITY0-any-biome.md`](../../docs/00-PRIORITY0-any-biome.md) section C | runner prints this list |

### Step 3 — lane material before the empty still (law 35)

Pack grammar stays: 3 lanes, 1-point lock-off, ZERO dog. Law 20 width / sky / plant are frame measures. They are not “must be asphalt”.

If `{PAINT}` already names a road material, use it. Otherwise propose this menu and do not cook P0 on a silent default:

| Key | Name | Look |
|---|---|---|
| A | Obsidian glass | Black mirror / obsidian road; cyan luminous edges or dashes in the reflection; pale ground beside |
| B | Crystal quartz | THREE translucent crystal/quartz lane ribbons; light refracts through; soft luminous edges (not painted asphalt dashes); pale ground |
| C | Luminous ribbon | Road = solidified light / Pack ribbon path (law 12 vibe); not concrete |
| D | Mix vault | Obsidian or crystal path + volumetric nebula-as-sky (thick 3D gas ceiling lighting the world) — not flat black night, not storm-grey clouds only |

**BAN** as silent default: grey concrete asphalt highway, MS-Paint dashes on béton, boring moderne nationale with no biome paint.

Swap `{LANE_MATERIAL}` in [`image-empty-plate.txt`](../../prompts/image-empty-plate.txt) before Imagine. `{PAINT}` includes that lane material. Law: [`35-lane-materials.md`](../../docs/35-lane-materials.md). Paste: [`COLD_START-lane-materials.md`](../../docs/COLD_START-lane-materials.md).

Law 27 ([`27-native-road-slide.md`](../../docs/27-native-road-slide.md)) is an optional catalog. It is not a default step.

### Step 14 — copy paths (law 34)

```
biome/docs/34-howl-live-aim.md
biome/scripts/howl-live/howlLive.js      → Live plates (howlFireSec, howlFxBeam, howlStep, cut-on-contact, shatter swap)
biome/scripts/howl-live/howlWet.glsl     → bolt-key-gl.ts (HOWL_VS / HOWL_FS)
biome/scripts/howl-live/demo.js          → node biome/scripts/howl-live/demo.js
biome/fx/howl/howl-attack.mp4            → REUSE. Do not recook.
```

Check the aim math without inventing a shader: `bash biome/scripts/biome-cook/biome-cook.sh howl`

### Runner (exit code = the real script)

```
bash biome/scripts/biome-cook/biome-cook.sh
bash biome/scripts/biome-cook/biome-cook.sh geo road-<biome>.mp4
bash biome/scripts/biome-cook/biome-cook.sh hazard --ref road-<biome>.mp4 --expect 1 dN.mp4
bash biome/scripts/biome-cook/biome-cook.sh mae road-N.mp4 road-N1.mp4
bash biome/scripts/biome-cook/biome-cook.sh scale
bash biome/scripts/biome-cook/biome-cook.sh clock
bash biome/scripts/biome-cook/biome-cook.sh despill
bash biome/scripts/biome-cook/biome-cook.sh curvature
bash biome/scripts/biome-cook/biome-cook.sh howl
bash biome/scripts/biome-cook/biome-cook.sh gpu
```

No plate args on `geo` / `hazard` / `mae` prints the example and exits 2. It does not fake a PASS.
