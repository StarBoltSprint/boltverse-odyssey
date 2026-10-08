# Objects from key crops — APPROVED 2026-10-08 (SmiR), the standard for every biome

**Status: APPROVED** (SmiR, 2026-10-08: "c'est la méthode qu'il faudra qu'on utilise à chaque fois … avec l'image
de base et ensuite on découpe les éléments pour faire vraiment les mêmes éléments"). This page is the object step of
the [biome bible pipeline](biome-bible.md). The bake stays the frigate / hard-object method
([`hard-objects.md`](hard-objects.md)) and `tools/biome/bake_hull.py`. Nothing here relaxes law 65, the Bolt lock or
standing rule 1 (visible world = real solids).

**Rule in one line:** every object of a biome is cut out of that biome's key still and rebuilt from those cuts.
A text-only object prompt is banned.

## 1. The key still is the anchor

- The biome key still (slot #1 of the bible, see [`biome-bible.md` §2](biome-bible.md#2-the-key-still-is-the-anchor))
  is the bible for shape, material, colour and light. Every object (towers, modules, spire, wreck, arch, props) is
  derived from it.
- If an object is not in the key, add it to the key first (Imagine edit of the key), then cut it out. Do not invent it
  from words.

## 2. Crop, upscale, save as sources

1. Draw one box per element on the key and record it in a **crops map** (`crops.json`: crop id → key box
   `x0,y0,x1,y1` in key pixels, the key file and its size, what each crop is used for). Also save a map image
   (`key-crops-map.jpg`, boxes drawn on the key) and a sheet of all crops (`crops-sheet.jpg`).
2. Upscale each crop (Lanczos, about 768 px on the long side) and save it as `crops/<id>.png`. These are the
   **sources** for every view of that object.
3. Detail-only crops (cables, ledges, panel grid) are second sources only, never an object of their own.

### 2b. Optional: detail key for hero objects

Key crops are small (a tower or a spire is often about 130 × 340 px in a 1280 × 720 key), so an upscale carries little
real detail and Imagine invents the rest. For **hero objects** (spire, wreck, arch, any landmark seen up close):

1. Make a **detail key** first: one Imagine **edit of the key still**, zoomed / reframed on that object, *same scene,
   same camera side, same sun, same haze, same materials*. One image per hero object.
2. Check it against the key: same silhouette (the [silhouette gate](#4-silhouette-gate) on the object's outline, after
   scale), same colours under the key light (`qc.py` against the anchor). A detail key that changes the object's shape
   is rejected like any other view.
3. Crop the object from the detail key at full resolution and use that crop as the main source; keep the small key
   crop as the reference outline for the gate and as a second source.

Regular modules and background objects skip this step.

## 3. Views are edits of the crop

- Every Imagine view is an **image edit** with the crop as source. Once the front view is accepted, it becomes a
  **second source** for the other views of that object (side, top, three-quarters).
- **Banned:** text-only image generation for an object, and any prompt that describes the object from memory instead of
  showing it.
- Views use a **neutral grey background and neutral studio light** (clean silhouette, readable albedo). This is the one
  exception to the "no studio light" clause of [`art-direction-aaa.md`](art-direction-aaa.md): it applies to object
  source views only, never to plates. Textures stay neutral; **the lighting is done in the engine** (§6).
- The prompt asks to keep the exact silhouette, proportions and materials of the source, isolated, full object in frame,
  no outline, no glow halo, no background props, no ground shadow.
- Budget: count views per object before starting (front first, then the rest) and stay inside the bible's image cap.
  One Imagine call at a time; log every call (slot, sources, prompt, file or error).

## 4. Silhouette gate

- Gate on the **front view**: mask IoU **≥ 0.80** against the crop's outline, after scale and centring. The other views
  of that object are made only after the front passes. A failed front gets one retry, then that object stops
  (stop after 2, workflow §2).
- **Check the reference masks first.** The outline must be a correct, **hand-checked** trace of the object in the crop.
  Lesson (zone B, 2026-10-08): automatic luminance masks missed sheared tops, sun-lit facets and towers partly hidden by
  others, so the IoU scored the mask, not the object. Trace or fix those masks before scoring any view.
- Report the aspect ratio of crop vs view beside the IoU: a view can score well and still be too wide or too thin.
- Visual review may accept a **near miss** (a view just under 0.80 whose shape is clearly right). Fix proportions
  (too wide base, too thin shaft) **in Blender** by scaling the solid, not by spending more images.
- Colour QC (`qc.py`) runs too, but it never replaces the silhouette gate (see §8).

## 5. Blender: real 3D volumes

- Real solids only: multi-view bake (`tools/biome/bake_hull.py`) or the frigate loft
  ([`hard-objects.md`](hard-objects.md)) for multi-piece heroes. No cards, billboards or sprites.
- **Sealed** meshes (non-manifold edges = 0, general hole fill), LODs decimated after the bake, one shared atlas per
  object family where possible.
- **Real cables** as Blender curves (thin tubes with a catenary sag between anchor points), textured from a detail crop.
  Never painted cables on a card.
- **No mirroring of views.** A missing back or left view is built on the solid from its neighbours with per-face
  variation and counted as fallback; a pixel mirror is FAIL.
- Derive extra modules (base, top, stub) from existing models when possible (cut, extend, cap) instead of new images.

## 6. Engine lighting matches the key

- The engine lights every object with the key's **lock sentence**, read from the biome bible: one low sun on the key's
  side and elevation, its kelvin and key colour, a coloured sky fill, coloured shadows (never black), a warm ground
  bounce from below and the horizon haze. Zone B (Ember Mesa): sun 8° above the horizon from the right of the key
  camera, 2900 K, violet fill, deep violet shadows, warm sand bounce, rose haze. The hex values live in the untracked
  `tools/biome/biomes/<id>.local.json` (repo rule 2026-10-03: palettes stay out of tracked files).
- At each base: sand drifts (or the biome's ground equivalent) piled against the object, a **contact shadow**, and the
  ground's warm bounce on the lower façades, so nothing looks pasted on.
- Repeated modules and props are drawn with **GPU instancing**; phone caps stay standing rule 9.

## 7. Review before integration

Show the user, before anything goes into the game or the preview:

1. A **sheet**: for each object, the key crop (and the detail key, if any) beside an 8-angle **turntable** of the
   solid, with tris per LOD.
2. One **hero still** in the biome's engine scene, framed and angled like the key still, next to the key.

Integration waits for the user's OK.

## 8. Failure log — zone B, 2026-10-08 (first try)

- **What happened:** object views were made from **text prompts** only. They came out as squat pink octagonal stone
  blocks. The key shows tall thin dark graphite slab towers (smoked glass, brushed metal, ledges, ladders, cables,
  sheared tops) and a faceted black and silver spire blade with two amber rings.
- **Why it got through:** QC was colour-only (ΔE against the anchor). Colour QC said PASS or FAIL on light, never on
  shape, so the mismatch reached the user. About $1.40 of images were spent for nothing.
- **Fix:** this page. Crops of the key as sources, edits only, silhouette gate on hand-checked outlines, review sheet
  with crops beside the turntables. The redo (same day) matched the key at first look.

## Zone B worked example (not committed)

The 2026-10-08 redo lives in the agent workspace, outside the repo (large images and local files are not committed):
the key `key-city3.jpg` (1280 × 720), the crops map (`objects1-redo-spec.md`, eight boxes such as the spire
`720,0,900,450`), `objects1-redo/key-crops-map.jpg`, `objects1-redo/crops-sheet.jpg`, `objects1-redo/crops/*.png`
(spire, five tower slabs, cables / ledges, far skyline), the hand-traced masks in `objects1-redo/masks/`, the
re-scored gate in `objects1-redo/gate-rescore-traced.json` and the call log `objects1-redo/gen.jsonl`. Repo outputs of
that run go to `tools/biome/out/ember-mesa/objects1-redo/` (ignored by git).
