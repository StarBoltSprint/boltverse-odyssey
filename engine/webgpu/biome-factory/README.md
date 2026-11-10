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

Colour compares only when both sides name the same light and the same exposure. The threshold stays CIE76 10 and L* counts.

Director decision, recorded: the environment key is an artistic reference only. Real-colour Imagine albedo wins. The blocking crystal colour gate renders the crystal scene and samples lit, view-facing patches of each material. It compares those pixels with the albedo the shader sampled times the night-rig irradiance of that patch normal. CIE76 limit 10, lightness included. Run `node engine/webgpu/crystal/test-render-colour.mjs`. A darkened material in the shader must fail that test. The key comparison is `keyAdvisory` on the factory state. It is not a hold and it is not a release blocker. The morning raw dE 19–66 stays a diagnostic of the old key-versus-unlit comparison. `--same-light crystal-rig` remains the grey-card test choice and is not the blocking gate.

Director decision, recorded: the 0.015 sky limit is unchanged, and it is not a difference between two view directions. Direction structure is the nebula. The blocking check renders fixed world directions from many camera yaws, pitches, and positions, so each direction lands at different screen positions, and requires that direction's colour to stay within 0.015 across those renders. A slow 360 turn must keep each tracked direction within 0.015 from one frame to the next. The old elev-12 pair is advisory and does not block. A camera-relative screen-space sky is the negative control and must fail. Run `node engine/webgpu/crystal/test-sky-anchor.mjs`.

```bash
node engine/webgpu/biome-factory/test-colour-same-light.mjs
node engine/webgpu/biome-factory/test-sky-sphere.mjs
```

`--biome reach` loads `engine/webgpu/reach/biome.factory.json` through the same command and stays HOLD. It does not use the crystal night rig. Open the page at `engine/webgpu/reach/reach.html`.

`--biome glacier` runs the glacier CPU gates and writes HOLD. The dawn sky lives in `engine/webgpu/glacier/dawn-sky.js`. The crystal night sky stays in `procedural-sky.js`. Open `engine/webgpu/glacier/glacier.html`.

The crystal candidate sky is house code, a full sphere coloured by direction. The nebula is domain-warped fbm of that unit direction, denser on a tilted band that crosses the chase-camera sky and fades toward the horizon. Stars stay on the same direction grid, with a small spread of size and brightness. It is not an Imagine JPEG, and the 2048×1024 contract does not apply to it. Materials stay Imagine. The 16:9 plate stays blocked.
