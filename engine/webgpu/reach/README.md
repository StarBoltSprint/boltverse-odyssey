# Obsidian Reach

Isolated kilometre candidate. It does not replace the meadow pages.

```bash
python3 -m http.server 8000
```

From the repo root, open `http://127.0.0.1:8000/engine/webgpu/reach/reach.html`.

The stone is the measured zone A ground stills at 1.45 m (`packs/zone-a/src/ground/m0.png`–`m3.png`). Bolt is the live meadow atlas, card height 1.15 m, boom 2.35 m, centred.

Hold to run. A and D yaw. `?run=1` plays the scripted gallop. `?debug=1` shows the position line.

Checks:

```bash
node engine/webgpu/reach/test-scale.mjs
node engine/webgpu/reach/test-lod.mjs
node engine/webgpu/reach/test-pop.mjs
node engine/webgpu/reach/test-frame.mjs
node engine/webgpu/biome-factory/make.mjs --biome reach --no-swatch
```
