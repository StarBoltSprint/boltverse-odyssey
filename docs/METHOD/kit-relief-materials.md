# Kit + relief + material library — the method (Zone D tier, 2026-10-13)

Back to [METHOD.md](../METHOD.md). Tools: [`tools/materials`](../../tools/materials/README.md), [`tools/kit`](../../tools/kit/README.md), [`tools/scatter`](../../tools/scatter/README.md).

## In plain words
One Imagine key image is 1024 px. On a wall up close that is ~16 px per metre: blurry. We need 500+.
1. **Solid kit pieces** (tiers, recess, cornice on a support, drifts, icicles) are fitted to the key: outline from SAM masks, step lines from the key, **depths from rules** (rise 2.5 m, tread 2.5 m, recess ≤ 2.5 m) because single-image depth inflates them.
2. **Imagine tileable materials** come from tight crops of the key (basalt, snow). Same colours, 512+ px/m. They are stored once in the **material library** and reused.
3. Each material's **height map pushes real relief** into the geometry (stones proud, joints deep, drifts rounded), strongest near the player and **fading with distance**, with LOD0/1/2.
4. **Hex tiling + triplanar** in the shader hides the 1024 repeat; the key's colour gain stays on top so it still reads as the key.
5. **Scatter + detail layers** (rocks, debris, tufts; dirt, snow, cracks, moss) are placed by key masks and rules, instanced for the phone.
Every colour pixel is Imagine. Light and shadows are computed live.

## Order
`materials find` → (if missing) Imagine tile → `materials add` → `kit build --fit --fit-camera` → read `contact.jpg` + `metrics.json` → viewer `probePxPerM` → `scatter run` + `detail run` → Critic + Art Director → only then `library add --intake` (KEEP). Before that: `library add-wip`.

## Gates
| Gate | Bar | Where |
|---|---|---|
| Material dE vs key crop | ≤ 5 | `materials check` |
| Material texel density | ≥ 500 px/m (texture) and **live** ≥ 500 at the 3 m spine cam | `materials check`, `probePxPerM` |
| Scene content in a tile | none (no sky gradient, seams wrap) | `materials check` |
| Repetition | hex peak ≤ 0.35 and below plain | `materials check`; re-run on captures |
| Shape | IoU closed ≥ 0.85, raw ≥ 0.75 | `kit build` |
| Watertight | 0 open edges (icicles excluded) | `kit build` |
| Phone | LOD0 ≤ 90k tris; scatter ≤ budget draw calls / tris / instances | `kit build`, `scatter run` |
| Walkable | no prop within path clearance | `scatter run` |
| Eye | Critic + Art Director KEEP from the play build | humans/bots, not a tool |

## Known failures (do not repeat)
- **v1 two boxes: IoU 0.45.** Plain blocks miss the recess, the band and the icicle fringe. Pieces must follow the key outline.
- **MoGe depth inflation.** Monocular depth read the treads at 5.3–8.0 m; the key reads 2.5 m. Clamp every depth to a rule; never trust raw depth for kit depths.
- **Snow chosen by surface angle reads dark.** v5 put snow where the normal faced up; the key's snow is driven by its **snow mask** and lit pale. Drive snow cover per face from the key snow mask (`detail.py` `mask` + `up_facing`) and gain it to the key.
- **Uniform decimation spikes blocks.** Decimating displaced lod0 uniformly turned stone blocks into spikes (v5 "hérissé"). Build each LOD from its own tessellation (`res_m`) and drop the block push below LOD0.
- **Offline px/m lies.** v4 measured 512 offline but the viewer ran ~200 px/m (downscaled textures). Only the live probe counts.
- **Floating cornice.** A slab with nothing under it reads as floating from the side. Seat it on a support block (v4 fix).
- **Grey cones.** Icicles with no material read as grey cones in the sky; they need the ice material and must grow out of the drift.

## Status 2026-10-13
Tier kit = **WIP** (`biome/library/_wip/zd-tier-terrace`). v4: IoU 0.747/0.869, dE 2.37/3.48, 0 open edges, but Critic + Art Director FAIL (snow identity, icicles, block depth 8 cm vs 20–40 cm, ground, 195.5k tris). The CLI's parametric tiers score 0.46/0.55 until the SAM-outline extrusion is ported from `tools/kit/legacy/relief6.py`.
