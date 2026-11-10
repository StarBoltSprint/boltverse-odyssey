# Obsidian Reach — first km-scale biome candidate

Goal: one isolated page in the house WebGPU engine, a kilometre basin with a far horizon, terrain LOD and streaming, GPU culling, huge structures, and the physical ground-to-space atmosphere. Bolt stays the live meadow atlas, same card size, centred behind the camera.

Rails: reuse `engine/webgpu/biome-factory` with a per-biome config. Materials are the measured zone A ground stills at 1.45 m, not a cropped reference. No new Imagine call, no API key, no paid service. Do not edit the meadow page, the live pages, or the crystal workstream. Do not lower a factory threshold.

Done when:

1. `engine/webgpu/reach/reach.html` runs on its own and the meadow pages are untouched.
2. `node engine/webgpu/biome-factory/make.mjs --biome reach --no-swatch` finishes on the reach config.
3. Scale check: Bolt card matches the live meadow, ground tile is 1.45 m, magnification stays ≤ 1.
4. LOD seam check: adjacent clipmap rings share an edge and the height error on that edge is under 1 mm.
5. Far-pop check: a structure taller than 80 m stays visible from the moment it enters the far frustum until it leaves it.
6. Frame-time check writes a measured WebGPU median or an explicit unproven line. Phone FPS is not invented.
7. A 720×1280 capture shows Bolt moving through the basin, or the report says the capture could not be taken.
8. The factory colour threshold stays CIE76 10.
