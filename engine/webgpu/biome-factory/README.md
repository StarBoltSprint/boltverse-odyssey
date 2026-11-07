# Biome factory

One command builds an isolated crystal candidate from `crystal/biome.factory.json` and the house mesh and shade modules. It does not call Imagine and it does not release.

```bash
node engine/webgpu/biome-factory/make.mjs --biome crystal
node engine/webgpu/biome-factory/test-factory.mjs
node engine/webgpu/biome-factory/test-assemble.mjs
```

Exit 0 is release. Exit 2 is HOLD. Exit 1 is a hard failure. `--no-swatch` skips the GPU sheet. `--force` renders the sheet again.

The run lands in `engine/webgpu/biome-factory/out/crystal/runs/<id>/`. A second run with the same config keeps that directory. `KEEP` is not written while the verdict is HOLD.

`make.mjs` copies the declared albedo files, checks their hashes, writes `pending.json`, and renders `swatch.png` through the same `shadeAlb` path as the canyon. The sheet is a close-up diagnosis, not a 20 s capture.

Sky is BLOCKED. GenerateImage accepts only aspect ratios 1:1, 4:3, 3:4, 16:9 and 9:16. It has no width, height, or equirectangular control, so a native 2:1 at 2048×1024 or larger cannot be requested. The 1280×720 plate is not resized and is not a 360. A cubemap of six 1:1 faces, or eight 60° views with a 45° step and 25% overlap, would be a different cook. None of those images were generated.

Phone performance, gait, and a visual KEEP are not signed off.
