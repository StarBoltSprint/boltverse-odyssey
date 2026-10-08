# Ground v2 — same-albedo relief, texture bombing, real big rocks

Back to [METHOD.md](../METHOD.md). Base recipe: [ground.md](ground.md) (unchanged). **Status: IN TEST (2026-10-08)**, Ember Mesa ground pass. Source: Grok on X 2026-10-08 + Grok chat; owner OK to rebuild the ground this way.

Same principle as [ground.md](ground.md) (Imagine colour tiles + invisible relief). v2 fixes two problems: some tiles had visible mirror joins, and nothing broke the repetition.

## Rules

| Item | Value |
|---|---|
| Albedo | Seamless **top-down** Imagine tile, same light sheet, no watermark. Tile test: 2×2 copies, no seam. |
| Height map | **Derived from the same albedo** (depth + high-pass), so the pebbles get the relief. A separate Imagine "height map" does not line up (it had other shapes) and looks lit, not a height field. Rejected. |
| Anti-repetition | Texture bombing, **3×3** cells, random offset **0.15** |
| Detail | 256 px detail tile at **8×** |
| Macro variation | sine macro **0.08** over large UV |
| UV | large world-locked UV; magnification ≤ 1 still applies |
| Light | unlit; fog far = sampled horizon (Ember Mesa #c49c6f) |

## Gravel vs rocks

- **Small gravel** = height relief only. Thousands, almost free on the phone.
- **~20 big rocks near the track** = real 3D Blender objects ([blender-imagine-bake](blender-imagine-bake.md) recipe A), streamed ahead of Bolt, each with a contact blob and a cast shadow ([lighting-coherence](lighting-coherence.md) §7). That is the AAA split: lots of detail painted in the ground, a few real objects where the eye looks.

When the [biome pipeline](biome-pipeline.md) exists, re-run the ground plates through its cleaner + LUT (seconds, no Grok credit). Regenerate only if the QC checker finds a light mismatch.
