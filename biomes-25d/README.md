# biomes-25d — empty-plate output (not hung)

Cook: [COOK-BIOME-25D.md](../COOK-BIOME-25D.md).  
`node scripts/cook-biome-25d.mjs <style> --dry-run`  
Speed: `node scripts/biome-25d-speed.mjs biomes-25d/<style>` → `playlist.json` (`rateCurve`, live `rate(t)`, **SAMPLE_DT=0.1**).  
Analyze: `node scripts/biome-25d-speed.mjs --analyze biomes-25d/<style>` — per-plate MATCH / mean-min-max / recook stretches + tint health (~10 Hz / 0.1 s). Loose mp4 paths OK (`--analyze p1.mp4 p2.mp4 …` / `--keep plate-empty-keep.mp4`).

**SPEED REF** (Imagine-side): [COOK-BIOME-25D.md — SPEED REF — plate-1 KEEP Imagine prompt](../COOK-BIOME-25D.md#speed-ref--plate-1-keep-imagine-prompt).  
Binary KEEP = `plate-empty-keep.mp4` (optical-flow). Prompt KEEP = that verbatim recook (Much FASTER / world rushes hard). `rate(t)` 1.0–1.6 is the post-cook filet only.

Not `packs/`. Not hall `/r/<slot>`. Hall `catalog/asteroid.md` is citadel paint — not this sprint. Drop films + playlist into bolt-hybrid `play/public/biomes/<style>/`.
