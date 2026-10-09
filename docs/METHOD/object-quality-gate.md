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
6. **Texel policy (SmiR 2026-10-09 20:19):** sharpness is judged as the phone sees it from 8 m and farther, with no
   camera distance limit; closer is exempt. Uniqueness is not required: one shared plate set per type, never the same
   pixels within 30 m, never shared by neighbours. Imagine plates are 1024 × 1024 native. Set in `profiles/_base.yaml`.
   **Material method A/B (2026-10-09):** a layered / hybrid method (tiling Imagine materials + unique macro plates +
   stochastic hex tiling, see `arch-research-1008/q18-answer.md`) is being A/B tested against unique section plates.
   The gate judges the result, not the method: visible px/m and repetition must be measured on the final render, so
   the same rows apply to both. Today: repetition is measured on the rendered face views and captures (both methods);
   tiling materials declared as `tile` / `detail` are not scored on their UV period. The visible px/m row still reads
   sampling px/m of `plate` textures only, so a layered material whose sharpness comes from the detail layer would
   FAIL it. Next step: a render-based visible px/m (sharpness measured in the 8 m captures) so both methods are
   scored the same way.
7. Quality first: the budget rows (draw calls, triangles, texture MB) are reported, never a reason to shrink a texture.

## What it checks (one row each, FAIL blocks)

| # | Check | How it is measured | Default |
|---|---|---|---|
| 1 | **Visible px/m** per object, per surface (policy `visible`, SmiR 2026-10-09 20:19) | For every **plate** texture (role declared in the spec) and every surface (signed normal class) of every placed copy: plate sampling px/m (UV area × texture pixels / world area; projected plates: plate px / metres spanned; pools: layer px / cell m). Required: the phone screen's px/m when that surface is viewed from 8 m, `renderH / (2 d tan(vfov/2))` with `renderH` = 2400 / 2.625 × the game's render pixel ratio (1080 × 2400 phone). Closer views are exempt (slight blur right against a wall is accepted). No camera distance limit: every surface is scored at 8 m unless the spec gives a per-class `viewMinM` with a reason. Detail / tile textures never count. Policy `unique` (unique px/m ≥ 64, ≥ 128 within 30 m of the path) is kept for comparison. | Zone B (pr 1.5, vfov 58°): ≥ 155 px/m; a native 1024² Imagine plate covers ≤ 6.6 m |
| 1b | Plates not downscaled | Served file ≥ the Imagine original (from `tex-manifest.json` or spec `source:`), GPU image = served file, no resized `createImageBitmap`. | — |
| 1c | Filtering | mipmaps + `LinearMipmapLinear`, anisotropy = renderer max | — |
| 1d | UV stretch | area-weighted p95 of the per-triangle singular-value ratio | ≤ 1.3 |
| 1e | Scene self-report | the scene's own px/m claim vs the measured px/m (visible, or unique under policy `unique`) | claim ≤ 1.25 × measured |
| 2 | **Repetition** | **No visible repetition, instead of unique pixels:** one shared plate set per object type is allowed; identical plate pixels never within 30 m (a plate tiling with a period < 30 m, or a pool whose ortho facade view correlates at the cell period); neighbouring copies of the same set (< 7 m apart) never share. Plus (capture) fronto-parallel orthographic views of the front and side faces of the hero copy and the close and low phone portrait captures: unbiased autocorrelation of the high-passed luma inside the object mask, and the correlation at the plate's own tile period. | 30 m, 7 m; peak ≤ 0.75, ≤ 0.5 at the plate period |
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

Programmatic use (Imagine-to-3D modules, other tools): the stable API v1.2 (`gateObject`, `gateScene`, `gateAndFix`,
`listProfiles`, `loadProfile`, `screenPxPerM`, row `id`s, report JSON) is specified in [`tools/object-gate/API.md`](../../tools/object-gate/API.md).
Additions bump the minor; a breaking change needs a major bump, a migration note there and a decisions-log row.

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
