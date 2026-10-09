# Object quality gate — MANDATORY for every object and every biome (APPROVED by SmiR 2026-10-09 16:27)

Back to [METHOD.md](../METHOD.md) · tool: [`tools/object-gate`](../../tools/object-gate/README.md) · pipeline hook:
[Imagine to 3D](imagine-to-3d.md) · object method: [objects from key crops](objects-from-key-crops.md).

> SmiR 2026-10-09 16:27: "pour tous les objets il faut que ce soit automatique, zéro erreur."
> SmiR 16:29: the gate applies to EVERY object whatever its type, and it is the last stage of the Imagine-to-3D tool.

## Rule

1. **Nothing is shown to SmiR, merged, published or exported to the catalogue before `object-gate` says PASS** for that
   object, in the build that will be shown. No exception for "just a quick look", no hand-written PASS: paste
   `report.md`.
2. It applies to **every type**: hard-surface buildings and ruins, rocks / mesas / arches, vehicles / wrecks, props,
   vegetation, ice, creatures (later), particles and effects, and the ground of a biome. The type picks a **profile**
   (`tools/object-gate/profiles/<type>.yaml`): thresholds + checklist template.
3. Every FAIL **blocks** and prints **fix hints**. In the Imagine-to-3D pipeline the hints become an automatic fix
   plan; the object is re-gated; only PASS objects are exported. Same defect failing twice → stop and report
   (workflow §2).
4. A threshold can only be loosened in the object spec under `thresholds:` **with a written reason** next to it. The
   report prints the effective numbers.
5. **Never edit live preview files in place** (lesson 2026-10-09 17:14: a job editing the live tree broke SmiR's link).
   Edit a staging copy, gate the staging URL, swap into live only after PASS. The gate treats the live tree as
   read-only and FAILS the run if any live file changes while it gates.
6. Quality first: the budget rows (draw calls, triangles, texture MB) are reported, never a reason to shrink a texture.

## What it checks (one row each, FAIL blocks)

| # | Check | How it is measured | Default |
|---|---|---|---|
| 1 | **Native Imagine px/m** per object, per surface | For every **plate** texture (role declared in the spec) and every surface (signed normal class) of every placed copy: UV area × texture pixels / world area. If the plate's UV area on that surface is > 1 the plate **tiles**, the pixels are not unique, and the score is `sqrt(texture pixels / surface m²)`. Detail / tile textures never count. Shader-projected plates: plate px / metres spanned × copy scale. Plate pools (an array of section plates, one layer per cell, picked by a lookup — TEX4): sampling = layer px / cell m, unique = `sqrt(layers × layer px / wall m² of every object sharing the pool)`. | ≥ 64 px/m, ≥ 128 px/m within 30 m of the player path |
| 1b | Plates not downscaled | Served file ≥ the Imagine original (from `tex-manifest.json` or spec `source:`), GPU image = served file, no resized `createImageBitmap`. | — |
| 1c | Filtering | mipmaps + `LinearMipmapLinear`, anisotropy = renderer max | — |
| 1d | UV stretch | area-weighted p95 of the per-triangle singular-value ratio | ≤ 1.3 |
| 1e | Scene self-report | the scene's own px/m claim vs the measured unique px/m | claim ≤ 1.25 × measured |
| 2 | **Repetition** | (UV) a plate repeats on a surface → FAIL. (capture) fronto-parallel orthographic views of the front and side faces of the hero copy (lit as in the game, object only — a tiled plate repeats exactly there) plus the close and low phone portrait captures: unbiased autocorrelation of the high-passed luma inside the object mask, and the correlation at the plate's own tile period. | peak ≤ 0.75 (regular architecture reaches ~0.6), ≤ 0.5 at the plate period |
| 3 | **Approach morph** | deterministic approach 300 → 10 m on the N nearest copies, the game's own LOD logic runs at each step, silhouette mask IoU between consecutive frames | no drop < 0.8 or > 0.05 under the neighbours' median |
| 4 | **Shadows** | probe camera on the ground in the shadow: render with / without this object casting (shadow map forced to re-render). World-fixed = shadow mask IoU after moving the player 80 m. Colour = per-channel shadow multiply, low chroma, never violet. | IoU ≥ 0.9, chroma ≤ 0.18 |
| 5 | **Grounding** | rays from below on a 9 × 9 grid under the lower 20 % of each copy; lowest hit vs ground height | air ≤ 0.05 m |
| 6 | **Geometry** | welded non-manifold and open edges; facade relief = median per-metre range of facade offsets on ±x/±z; proportions vs spec | 0 / 0; relief ≥ 0.3 m on 2 faces (building) |
| 7 | **Key checklist** | per-object list of every visible key feature with capture angles (close, low phone portrait, far). The gate renders the captures, builds `capture-sheet.jpg` next to the key crop and FAILS unless every item has a **recorded pass on a current capture** (dHash within 12 bits) in `records/<id>.verified.yaml`. CIELAB ΔE vs the key crop reported. | all items |
| 8 | **Runtime** | console / page errors, shader compile, HUD + title text, portrait viewport (412 × 915, 540 × 1200), budgets reported; live tree untouched during the run (size + mtime of every live file) | — |
| 9 | **Effects** | particles / veils / dust: every effect mesh takes its look from an Imagine texture (allow-listed folders); typed colours reported | — |

## How to run

```bash
node tools/object-gate/cli.mjs --scene <zone>/scene.yaml [--url http://127.0.0.1:PORT/] [--only id,id] [--fast]
```

`--fast` skips the approach morph only for iteration; the delivery run is always the full gate. Output:
`out/<time>/report.md`, `report.json`, per object `capture-sheet.jpg`, `cap-*.png`, `texel.json`, `morph.json`,
`grounding.json`, `geometry.json`, `checklist-todo.yaml`.

## Writing an object spec

```yaml
id: tower-m2
type: building                     # profile
select: {names: "^inst-m2-"}       # regex on scene object names (InstancedMesh copies, LOD, meshes)
keyCrop: path/to/key-crop.png
textures:                          # EVERY texture the object uses, with its role
  - {match: "tex/m2\\.webp", role: plate, classes: ["+z", "-z", "+y"], source: imagine/m2-front.jpg}
  - {match: "detail\\.webp", role: detail}
proportions: {hOverW: [3, 5], dOverW: [0.9, 1.1]}
checklist:                         # from the profile checklistTemplate, one item per visible key feature
  - {id: relief, feature: "...", captures: [close, low-portrait]}
```

A scene needs an **adapter** (`tools/object-gate/adapters/`): how to reach the page's THREE scene, the player pose,
the ground height and the player path. The checks never change per scene.

## Why this exists — 2026-10-09

The Zone B towers failed repeatedly in one day while the old preview gate said PASS 52/52. Its texel row reported
256 px/m: that was the **tiled detail texture**. The real Imagine facade plates were 11–29 native px/m (a 720 × 1280
plate on a 31 × 113 m tower), which SmiR saw as blur and then, once tiled, as a repeating "carrelage". The same day:
towers morphing on approach (LOD variant swap), violet then sliding shadows, floating towers, flat facades, clumped
towers, a white spire, a shader that stopped compiling after a `?v=` bump, capture angles showing sky or a black wall,
sand that read like rain. Each is a row above. Entries: [`learn/failures.md`](../../learn/failures.md) 2026-10-09.
