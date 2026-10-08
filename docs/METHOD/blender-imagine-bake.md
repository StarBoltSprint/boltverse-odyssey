# Blender Imagine bake — every object is a real 3D volume

Back to [METHOD.md](../METHOD.md). **Status: IN TEST (2026-10-08)**, recipe A tested on one Ember Mesa butte. **Owner rule (SmiR 2026-10-08): no flat cutout objects anymore, ever.** Old flat cards and lofted box wraps get replaced, mesas first. Only the sky stays a backdrop.

Script: [`tools/blender/imagine_bake.py`](../../tools/blender/imagine_bake.py) (usage at the top of the file).

## Why Blender

The old way projected Imagine views onto a lofted box live in three.js. three.js cannot blend two views or bake them into one texture, so you get seams, a missing top, and a sticker look in orbit. Blender does the blend **once, offline**, and writes one clean mesh plus one texture. three.js only displays it. The result is cheaper on the phone and has no seams.

- **Every pixel stays Imagine.** Each texel is a bilinear blend of input Imagine pixels. No procedural colour, no added light.
- **Mesh = invisible shape** (Golden rule: code computes shape only). Blender is an offline tool. It never ships at runtime.

## Run it (box, CPU, no GPU)

Blender **5.2.1 LTS** at `/home/box/.local/bin/blender`. Always headless:

```bash
blender --background --factory-startup --python tools/blender/imagine_bake.py -- \
  --front in/butte-0.png --side in/butte-0-side.png --back in/butte-0-back.png \
  --top in/butte-0-top.png --out out --height 30 --vox 0.18 --bury 0.8 --hull front,side
```

Writes `out/mesa.glb`, `out/mesa_albedo.png`, `out/stats.json`. One script for every solid. The shape comes from the input silhouettes, so new mesa images give a new shape (wider, tower, arch-like). No per-object script.

## Inputs

Straight-alpha RGBA PNGs of **one** object: 4 side views (front, back, left, right) + 1 top view. Same zone [light sheet](lighting-coherence.md) in every prompt, orthographic-ish, ground at the bottom. Cut out with Grok Build 1.0.50+, edge bleed 2–4 px.

- front = seen from −Y (game +Z), back = +Y, right/side = +X, left = −X. Top: image-up = back (+Y).
- **Generate a real 4th view.** With only one side view the script reuses it for both flanks (mirrored).

## Recipe A — solid shapes (mesas, rocks, cliffs, big boulders)

1. **Visual hull** from the silhouettes (voxels, `--vox` 0.18–0.25 m). Front and back silhouettes may disagree: carve with `--hull front,side`. Texture still uses every view.
2. **Voxel remesh + smooth + decimate** to **~2–6k tris** (`--tris`, default 4000).
3. **Smart UV** unwrap.
4. **Project** the 4 side views + the top view per texel, weighted by `dot(normal, view)^3` × visibility (ortho depth test against the hull) × eroded alpha.
5. **Bake** to one **2048** texture (`--tex`), edge padding (bleed) so mips never show seams.
6. **Export GLB**, unlit (`KHR_materials_unlit`), JPEG **q90** embedded (`--jpeg`).
7. Apply the zone master LUT to the baked texture ([biome pipeline](biome-pipeline.md)). Blender adds no light: emission bake only.

### Test result — Ember Mesa butte-0 (2026-10-08)

| Measure | Value |
|---|---|
| Tris / verts | 3,887 / 1,955 |
| GLB | 513 KB (2048 JPEG q90 inside) |
| Time | ~30 s compute, 41 s wall incl. loading, CPU only, no Grok credit |
| Seams | none visible; rock grooves continue round the corners |
| Sticker effect at 3/4, close, orbit | gone |
| Green / black fringe px | 0 |
| Far (normal play distance) | about the same as the old wrap |

**Weak spots (fix in the full mesa pass):**
- Mirrored flanks: only one side view. Fix: a real 4th Imagine view.
- Top lighter and pinker than the sides; top cracks read slightly tiled from above. Fix: colour-match the top to the sides through the LUT.
- Base talus streaks and a sharp ground line. Hidden in game by the plum contact shadow, sand over the foot and fog; `--bury` 0.8 sinks the foot.

## Next improvements (Grok on X, 2026-10-08)

Choice: **extra views + displacement**, in this order.

1. **More views: 8+** (4 sides + 4 three-quarter). Biggest free lift for silhouettes (tighter hull) and projection (fewer stretched texels). Fixes the mirrored flanks. Script change: accept the 4 diagonal views in the hull and the projection weights.
2. **Then displacement** derived from the Imagine texture, applied to the ~4k mesh in Blender to cut grooves and cavities into the real geometry. Display is unlit, so a normal map alone shows nothing: displace the vertices (subdivide → displace → decimate back to budget), keep a normal map only if a lit path ever exists.

Rejected for now: CPU depth models (DepthAnything / MiDaS) add real depth but are slow on the box; shape-from-shading is weaker.

## Recipe B — complex objects (Anchor arch, wrecks, lattice towers, holes, separate parts)

Silhouettes fill holes, so recipe A cannot do these. Use the [frigate measurement method](hard-objects.md): measurement images from Imagine, real cross-sections, separate parts, holes kept. Build those parts **in Blender** (piers, arch, beams, openings), then run the **same projection bake**. Both recipes give real volumes. Giant arch specifics: [giant-arch.md](giant-arch.md).

## Display in three.js

Load the GLB, keep `MeshBasicMaterial` (unlit), `NoToneMapping`, sRGB. three.js adds only position-dependent things: fog, contact and cast shadows, grain ([lighting-coherence](lighting-coherence.md) §7–§8). Far LOD = a lower-poly decimation of the **same** bake, never a card ([aaa-look](aaa-look.md) §10).

## Optional later — AI multi-view reconstruction (PARKED)

Hunyuan3D (free, needs a GPU server), Tripo, Meshy or Rodin may give a better **shape** from our views. Allowed only as invisible shape, then Blender bakes the Imagine pixels on it (pixels stay 100 % Imagine). The prior TripoSR test on the ship (2026-10-02) was not better (~70 % of the visible surface had a real Imagine texel; see [rejected](rejected.md)). The Golden rule still bans TripoSR-style generators in play assets. Needs an owner decision and a one-rock A/B before any use.

## Done when

1. [ ] 4 real side views + 1 top, same light sheet, cut out 1.0.50+.
2. [ ] GLB ≤ 6k tris, one 2048 texture, unlit, no seam at 3/4 and in orbit.
3. [ ] 0 black / green fringe px; top colour matches the sides after the LUT.
4. [ ] Contact + cast shadow in game; foot buried; phone proof shows no sticker.
