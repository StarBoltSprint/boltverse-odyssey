# World graph (zone.v1)

One zone is one JSON file. The file does not draw. three.js in the Zone B preview still draws. This page is the method for that file. It does not add an engine.

## File

`schema/zone.v1.schema.json` is the versioned schema (`schema` is the string `zone.v1`).

A zone names, for each object: the GLB (or `null` when the preview has no GLB), LOD file list, Imagine source images, the cameras that produced those images, the world transform, fidelity thresholds, and a `wake` block. Wake is `{ "type": "placeholder", "enabled": false }` until a later step turns it on.

The zone also names `keyImage`, `keyCamera`, `biome` (the bible file, ground and sky included), `lighting` (sun, fog, halo), `gameplay`, and `qualityGates`.

`runtime` holds the bytes the live page already fetches: `biome.json`, `objects1/layout.json`, and `gdet/ground-detail.json`. The loader answers those three URLs from the zone. Every other URL still hits the preview files.

## Export

```
node tools/world-graph/export-zone-b.mjs
```

writes `zone-b.zone.json` from the current Zone B preview. It copies stored numbers. It does not invent a lane count, an Imagine camera, a second LOD file, a fidelity threshold, or a halo colour. Anything the preview does not store goes in `todo`.

Hero world xz is the spawn literal in `objects-t7.mjs`. Street world xz is `avenue2At` from the bible runtime (defaults read out of that file, plus `biome.ground.relief.avenue2` when that object exists). The 8 m pose is `avenue-8m` in `/workspace/gd/ab-look/a/meta.json`. Its eye is null in that file. The preview uses 3.0 when the URL sets x or z and omits eye. The zone records both.

## Loader

`runtime/zone-loader.mjs` validates the file and patches `fetch` for the three JSON payloads. `bootZone(zone, mainHref)` then imports the preview `main.mjs`. The preview directory is not edited. `index.html` is not edited. A local server synthesizes a page that injects the same frozen clock on the reference page and the zone page:

- `performance.now` and `requestAnimationFrame` stay at 100000
- `window.__skyT = 120`, `window.__airT = 10`
- query `lockq=1&dyn=0&hud=0&grain=0` plus the pose

Grain is off so a frame-counter mismatch cannot move pixels. Both pages get the same query and the same clock.

## Pixel rule

The zone page and the live preview, shot from the hero, street, and 8 m poses, must have a mean absolute channel difference of 1/255 or less. The reference frame must not be black (mean luma above 0.05). The hero frame and the street frame must differ, so a stuck camera cannot pass.

## Verify

```
node tools/world-graph/selftest.mjs
node tools/world-graph/verify.mjs
```

Selftest checks the schema name, the export round-trip, the three payloads, the placeholder wake, and that `index.html` and `main.mjs` in the live preview did not change.

Verify renders `keyCamera` at the key image size, writes SSIM and LPIPS against that still, and records draw calls and triangles. The report is `steps/world-graph-1011/verify-report.json`. LPIPS is the Alex network from the installed `lpips` package. A missing import is a failed run, not a stand-in number.

`qualityGates` copies `biome.budgets` (`drawCalls` 12, `trisOnScreen` 150000, `texMB` 64). No LPIPS threshold is stored, so none is invented. The draw-call check is a measurement of the existing preview. This step does not retune that preview.

## Out of scope

No new renderer. No Imagine images. No edits under the live preview, and no edits in the fusion or unreal worktrees. The phone preview freeze does not apply: this step has no play directory.
