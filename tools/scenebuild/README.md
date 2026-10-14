# tools/scenebuild — whole scene from an AUTO key sheet (any key, zero code changes)

```
python3 tools/keysheet/auto_cam.py KEY SHEETDIR          # (auto_extract calls it) MoGe intrinsics -> camera.json
python3 tools/scenebuild/score.py SHEET OUT PORT          # first try: build -> render -> judge + auto_check
python3 tools/scenebuild/optimize.py SHEET OUT PORT       # per-element keep/revert loop (OUT/optimize.json, opt.json)
python3 tools/scenebuild/recipelib.py zd=SHEET,OUT,PORT   # validate recipes per zone -> recipes/library.json
python3 tools/scenebuild/check_recipes.py                 # lint recipes
```
OUT must be served (`python3 -m http.server PORT` in OUT, with view.html, three.module.js, jsm/).

* **Camera**: camera.json from MoGe (no hard-coded key camera). Camera at origin, OpenCV -> three (x, -y, -z).
* **Types** (eltypes.py): sky, ground, wall, ice_mass, stone_block, cornice, door, rubble, snow_pillow, tread_snow,
  snow_patch, icicle — from the element's fixed property set + MoGe normal.
* **Generators** = `ops.py` geometry core composed by **text recipes** `recipes/<type>.json` (versioned, `ops_version`).
  SDF ops after Inigo Quilez (rounded box, ellipsoid, cone, smooth-min, domain warp); meshing by own dual
  contouring (`mesh method=dc`, sharp edges: cornice, door, rubble) or skimage marching cubes (`mc`, snow / ice);
  manifold3d for hard booleans (`recess`, `chip` hitting a target volume) and hard blocks (chamfered hull);
  `split_wall` = our own CGA-style split grammar (wall -> courses -> blocks, key-seeded size/joint jitter), blocks
  are instances meshed once per quantised size. Every op declares its metric; `test_ops.py [camera.json]` checks
  watertight + metric within 5 % in key pixels. Recipe params are expressions over measured bindings
  (`w h th d rough snow joint px nx ch bw jv lod drips`). Adding a shape = adding a JSON file (`check_recipes.py`).
  Node graph cache: every node keyed by hash(upstream, op, params, seed) -> late-param changes rebuild downstream only.
  DC was tried on the stone blocks: ~75 tris/block vs 44 for the manifold3d chamfered hull at the same look, so
  blocks use the hull (phone budget); DC stays for the other hard types.
* **Wear / snow** from geometry: up-facing normals get the sheet's measured snow colour (x snow fraction), convex
  curvature lightens, concave darkens (build.wear_colours) - no global noise.
* **Optimizer** (optimize.py): batched CMA-ES per element (popsize 4, ~40 evals/element over FORM -> EDGES ->
  WEAR), worst-metric row as fitness + cheap geometric loss before render; keep a stage's candidates on NET GAIN: sum of
  worst-metric rows improves, no element drops > 10, held-out DINO term no worse, budget (12 draws / 200k tris) holds;
  non-improving worst elements go to the expressiveness-gap ledger in optimize.json.
* **Too regular** (regular.py): block-size spread, joint jitter, stripe FFT peak, skyline HF energy, render vs key on
  the key's stone segments; `selftest_regular.py` proves the regular_blocks fixture is flagged.
* **Draws**: one merged vertex-coloured mesh per type (<= 12 draws, icicles one mesh).
* **Colour + light (v2)**: every generated vertex gets the key's observed colour projected through the key camera
  (80 %, the measured albedo/wear colour 20 %); lights are calibrated on the key's median lit/shadow ratio r
  (ambient 1/r, sun 1-1/r, Lambert), so the render keeps the key's lit vs shadow contrast.
* **Exposure**: one probe render; light intensity scaled so mean luminance matches the key (fixed during the loop).
* **Recipe library**: `recipes/library.json` records per-zone median rows and the recipe hash; a recipe is
  `validated` once it passes on one zone; editing it clears its validation.

## Off-view gate (v4)
`offview.py SHEET OUT PORT` renders yaw -25 / +25, 45 deg high and a grazing close-up WITHOUT the projected key
texture, scores colour + DINO vs the key x (1 - hole fraction). This `off_score` is the gate number; the key-camera
judge is optimistic since the key image is projected from that camera. L1 forms are dilated by one grid step so
neighbouring forms overlap (no seams). optimize.py checkpoints opt.json after every stage.

## v5: geometry past the key frame + off-view holdout
* key depth edge-replicated 256 px beyond each frame edge, back-projected with the key intrinsics (non-sky), 4-step grid
* every L1 relief becomes a shell (back copy 6 % deeper along the view rays + stitched side faces), so off-views see
  plausible back/side faces instead of paper-thin sheets; L1 grid 12 px to stay inside the 200k tri budget
* optimize.py: DINO holdout = mean DINO over the 4 off-views (offview.py), tolerance 0.5; off_score recorded first/after
