# Biome factory

One command builds an isolated candidate from `engine/webgpu/<id>/biome.factory.json` and that biome's page. It does not call Imagine and it does not release on a HOLD.

```bash
node engine/webgpu/biome-factory/make.mjs --biome reach --no-swatch
node engine/webgpu/biome-factory/test-colour-same-light.mjs
```

Exit 0 is release. Exit 2 is HOLD. Exit 1 is a hard failure. `--no-swatch` skips the GPU sheet.

Colour compares only when both sides name the same light and the same exposure. The threshold stays CIE76 10 and L* counts.

A reference image (`environment.jpg`, a key crop) is not a texture. A material tile carries its own file, its own hash, and a tile length in metres at or under 16.

Sky plates stay blocked until a real 2:1 equirect exists. House atmosphere code is not that plate.
