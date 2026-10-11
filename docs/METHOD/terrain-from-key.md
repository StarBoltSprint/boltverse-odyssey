# Terrain from the key image

Builds a Zone B heightfield from one key image (`key-city3.jpg`) and its camera prior, then gates it. No Imagine images. The live preview `index.html` is not edited; the result is served from `tools/terrain-from-key/staging/`.

Worked take: [`steps/terrain-key2-1011/REPORT.md`](../../steps/terrain-key2-1011/REPORT.md) (PASS). Earlier failed take: [`steps/terrain-key-1011/REPORT.md`](../../steps/terrain-key-1011/REPORT.md). Recipe: [`learn/recipes/terrain-key2-skyline.md`](../../learn/recipes/terrain-key2-skyline.md).

## Why not unproject depth

From the key camera the sand only reaches about 8 m, and a downward ray never crosses a crest above the eye. Depth alone cannot place 15–30 m side dunes. The failed take (plane fit, then ray placement from Depth Anything V2 small) is logged in `learn/failures.md`.

## Steps

1. **Colour ground mask** (`mask_depth.py`): sand vs sky/towers on the key image.
2. **Skyline** (`build_field.py`, `skyline_fill`): the top of the ground mask, column by column, gives the crest outline.
3. **Compose the field** (`compose_from_skyline`): crest heights and the along-track wavelength come from that skyline plus known scales — side bodies 15–30 m, wavelength 96 m, bible wind 60°, setback 36 m.
4. **Walkable avenue**: flat trench inside 0.8 m of the centreline, then a smooth shoulder from 0.8 m to 3.5 m that tops out just under the eye (1.85 m). A hard step aliases through bilinear samples and reads as ~30° of slope.
5. **Depth (optional)**: MoGe-2 is the default (`vision_models.DEFAULT_DEPTH`). It only nudges the near slab (≤ 0.8 m). Depth Anything V2 Large is an internal comparison only and is never written into the step folder.
6. **SAM2 trial (optional)**: a SAM2 small mask intersected with the colour ground. On Zone B it was full of holes (silhouette IoU 0.5486), so the colour outline shipped.
7. **Gates** (`gates.py`): silhouette IoU ≥ 0.80, depth order, features (banks ≥ avenue + 1.2 m), LOD pop IoU ≥ 0.90, approach IoU ≥ 0.85, repetition < 0.75, corridor (max slope ≤ 16°, median sink ≥ 1.2 m), vertex cost = the live LOD table.
8. **Play captures** (`capture_play.mjs`): one shot while `Chargement` is up (must FAIL the capture gate), one after (must PASS), 1280×720 and 720×1280, live and staging.

## Run

```bash
python3 tools/terrain-from-key/run.py            # build + gates, writes steps/terrain-key2-1011/
python3 tools/terrain-from-key/serve.py --port 8767   # staging page beside the live preview
node tools/terrain-from-key/capture_play.mjs <page-url> <out-dir> [tag] [width] [height]
```

Inputs are box paths (`/workspace/zb-bible-1008/key-city3.jpg`, `.../compare/run2/camera-key.json`, the live preview `main.mjs`). Swap them for another zone.

## Known gaps

The big dunes read as steep banks/cliffs in play frames because the ground albedo is stretched up the slope (texture fix pending). The rig still owns field of view, so play frames are not a 64° match to the key.

## Models and licences

MoGe-2: MIT, default depth. Depth Anything V2 Large: CC BY-NC 4.0, internal comparison only. SAM 2.1: Apache 2.0. No weights in git.
