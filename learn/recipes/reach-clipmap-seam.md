# terrain — clipmap seam

Status: engine candidate. No Imagine prompt. Not a visual KEEP.

| Field | Value |
| --- | --- |
| Asset kind | other |
| Take | obsidian-reach-km |
| Commit | this step |
| Date | 2026-11-09 |
| Size | outer radius 16384 m, 10 rings, cell 1 m doubling |
| Tries | 1 |
| CLI | none |
| Image refs | none. Stone is the existing zone A ground stills at 1.45 m. |

## Prompt

not stored. No prompt was sent.

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `node engine/webgpu/reach/test-lod.mjs` | seam and stream | seam 0.0014 mm, missing 0, radius 16384 m, chunks move |
| `node engine/webgpu/reach/test-scale.mjs` | tile and Bolt | tile 1.45 m, mag 0.714, Bolt 494.2 px, NDC x 0 |
| `node engine/webgpu/reach/test-pop.mjs` | far structure | spire 740 m, 65.8 px at 12 km, flips 0 |

## Gotchas

The rings share the camera centre, and the cell size doubles, so the coarse edge is every other fine vertex. The odd fine-rim vertex must use the average of its two coarse neighbours. Analytic height on that odd vertex opens a crack.

Headless Chrome on this machine destroys the WebGPU device on submit. A black screenshot is not a frame.

## Reuse

Copy `engine/webgpu/engine/bricks/terrain-clipmap.js` and pass another height function. Swap the stone files in the biome config. Do not retile a reference photo.
