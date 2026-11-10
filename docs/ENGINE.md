# Bolt Engine (house WebGPU)

## Texture rule

Every Imagine texture is used at its own full size. The factory does not enlarge it and does not stretch it onto the mesh.

The density floor is **2048 native pixels per metre**. That number is `MIN_PX_PER_M` in `engine/webgpu/biome-factory/texel-gate.mjs`. A biome config cannot set a lower number. With a 1024 px image, one tile can cover at most half a metre. A 1024 px image declared at 1 m is 1024 px/m and the build is refused. The same image at 0.5 m is 2048 px/m and clears the density check.

Ground, floor, snow, ice, walls, and cliffs need at least four different Imagine variants (`MIN_LARGE_VARIANTS`). A crystal or other small prop needs at least three (`MIN_PROP_VARIANTS`). Two copies of the same file count as one variant: the bytes must differ by sha256. A biome config cannot lower either count, the same way it cannot lower the 2048 px/m floor. Each variant carries its sha256 and its native width and height. If the file is larger than that stored native size, it was upscaled and the build is refused. A small prop still keeps the metres written for it, and still needs 2048 px/m.

On the mesh, the area-weighted 99th percentile of the long-texel to short-texel ratio stays at or under 1.3. At the follow camera's nearest ground, the texture is not magnified past one screen pixel per texel. Every material sampler has a full mip chain and anisotropic filtering.

The check runs before any swatch, render, or capture. A miss exits non-zero, records HOLD, and names the material and its px/m. Today's crystal ground is a 1024 px tile at 3 m, which is about 341 px/m, so that build stays HOLD. The pictures are not changed here to force a pass.

```bash
node engine/webgpu/biome-factory/texel-gate.mjs --all
node engine/webgpu/biome-factory/test-texel-gate.mjs
```

The house engine is the WebGPU code under [`engine/webgpu/`](../engine/webgpu/README.md). The root [`ENGINE.md`](../ENGINE.md) is the citadel DOM player. This file is the WebGPU engine.

A page is one HTML file plus a module. A brick is a `makeX(config)` function. A biome passes its own numbers into those bricks. The live meadow page does not import a candidate module.

## Default pages

These files match `main` byte for byte. Candidates do not edit them.

| Page | File | Role |
|---|---|---|
| Meadow | `engine/webgpu/m448aaa2.html` | Live meadow. River, mill, trees, Bolt stop. |
| Luminous path | `engine/webgpu/m445lp.html` | Paw-to-Galaxy climb. |
| Bolt gait | `engine/webgpu/m447g.html`, `m447v.html` | Gallop and reference checks. |

`engine/webgpu/m448aaa3.html` is a separate meadow candidate (breath, pace, occluders, diagnostics). It is not the live page.

Serve from the repo root:

```bash
python3 -m http.server 8000
```

## Architecture

```
engine/webgpu/
  m448aaa2.js          live meadow page
  engine/              bricks (river, trees, atmosphere, taa, ssgi, footcontact, …)
  engine/bricks/       smaller bricks (follow camera, clipmap, idle helpers, …)
  engine/biomes/       biome config objects
  bricks/              Bolt idle and breath
  biome-factory/       one CLI, colour gates, crystal night sky
  crystal/ reach/ glacier/ candidates/foot-lock/
```

Imagine files are the albedo. The shader multiplies them by one light record. A procedural sky is house code and is named as such. It is not an Imagine JPEG.

## Reusable modules

### Bolt idle and gait

- `engine/webgpu/bricks/bolt-idle.js` — `boltIdle`. Stride clock follows distance. Meadow stride is 3.5897 m (7 m/s at 1.95 Hz).
- `engine/webgpu/bricks/bolt-breath.js` — gen4b breath clip and the idle/run crossfade.
- The card on the candidate pages is the live meadow atlas `bolt439_atlas.png`. Card height 1.15 m. The pages do not cook a new gallop.

The idle/run crossfade is still two pictures over 200 ms. Paw pixels on the live card are not locked to the ground. That is recorded as an open defect, not a fix.

### Contact

`engine/webgpu/engine/footcontact.js` — `makeFootContact(cfg)`.

Wired only by `engine/webgpu/candidates/foot-lock/`. `lock: false` is the skating baseline. The live meadow, the meadow biome file, and the tunnel do not import it.

On a fixed 10 s script at 1/60 s the locked soles move 0 cm/frame in straight, left turn, right turn, and brake. Before the lock the same soles moved about 11.7 cm/frame while running and 6.3 cm/frame while braking. Chest-band height stays 0 cm. Card scale stays 1. The brick does not draw fog.

### Atmosphere and sky

- `engine/webgpu/engine/atmosphere.js` — Rayleigh/Mie sky used by Obsidian Reach.
- `engine/webgpu/biome-factory/procedural-sky.js` — crystal night sky. Colour is a function of world direction. The nebula is domain-warped noise on a tilted band. Stars sit on that direction grid.
- `engine/webgpu/glacier/dawn-sky.js` — glacier dawn sky. It is not the crystal night function. Glacier imports this file, not `procedural-sky.js`.

Sky stability for crystal is measured on world directions, not on screen position. The limit is 0.015. A screen-space sky is the negative control and must fail.

### Night rig

`engine/webgpu/biome-factory/night-rig.js` reads `engine/webgpu/crystal/night-light.json`. One record for every crystal material. Moon elevation is the record's direction. `flatScale` is 0.4. Ambient and moon RGB are in that JSON. The rig is not fitted per texture.

### Materials and the real-colour gate

Albedo tiles for the crystal canyon are the Imagine JPEGs in `engine/webgpu/biome-factory/fixtures/materials-v2/`. The artistic environment key is not a texture.

`engine/webgpu/biome-factory/colour-same-light.mjs` compares two colours only when both name the same light. CIE76 limit is 10. Lightness is included. The threshold is `DE76_MAX`.

`engine/webgpu/biome-factory/render-colour-gate.mjs` scores rendered pixels against the albedo the shader sampled, times the rig irradiance of that pixel's normal. With no extra argument it uses the crystal night rig. A caller can pass another `shadeAt` (the glacier page passes the dawn rig). A darkened shader must score BLOCK.

Crystal specular stays on the albedo (`alb * nh` at weight 0.06 in `shade.js`). It is not a white specular lobe. The isolated TAA bench (`m449cand`) uses dielectric F0 0.04 and does not draw chrome.

### Biome factory CLI

```bash
node engine/webgpu/biome-factory/make.mjs --biome crystal
node engine/webgpu/biome-factory/make.mjs --biome reach --no-swatch
node engine/webgpu/biome-factory/make.mjs --biome glacier
```

Exit 0 would be a release. Exit 2 is HOLD. Exit 1 is a hard failure. The crystal and reach runs write under `engine/webgpu/biome-factory/out/<id>/`. Glacier writes `out/glacier/state.json` and stays HOLD. None of these commands calls Imagine.

### Defect gates and negative controls

Limits below were not lowered to pass.

| Gate | Limit | Negative control | Where |
|---|---|---|---|
| Rendered CIE76, lightness included | 10 | A darkened material must BLOCK | Crystal `test-render-colour.mjs`. Glacier `test-colour.mjs` (run 3 worst measured 0.61; darkened wall 14.77). |
| Same world direction across cameras | 0.015 | A screen-space sky must fail | Crystal `test-sky-anchor.mjs`. Glacier `test-sky.mjs`. |
| Pure black fraction | 0.0003 | An injected tear must fail | Glacier `test-defects.mjs`. |
| Grid peak | 1.8 | An injected grating must fail | Glacier `test-film-grid.mjs`. On the run 3 film, 151 of 300 frames are over 1.8 (min 1.163, mean 1.971, max 6.090). The limit stays 1.8. |
| Enclosed hole | 0 | A punched pixel must fail | Glacier `test-holes.mjs`. |
| Triangle budget | 200000 | | Glacier CPU count 189368. |
| Draw budget | 12 | | Glacier CPU count 8. |
| Paw slide while planted | 0 cm/frame after the lock | `?lock=0` is the skating baseline | `candidates/foot-lock/measure.mjs`. |

Crystal canyon also gates chamfer, chip, conchoid, fracture, gem volume, and the idle loop. Those scripts live in `engine/webgpu/crystal/`.

### Performance budget

No phone frame rate was measured for these candidates.

- Obsidian Reach: factory HOLD. Headless Chrome created a WebGPU device and destroyed it on the first submit, including a one-triangle page. No GPU frame time. The reach film is a CPU raster.
- Glacier: triangle and draw counts above are CPU counts of the mesh, not a frame time.
- TAA/SSGI bench `check/post449`: `math.test.mjs` is CPU math. `run.mjs` needs WebGPU. Its frame time is not a phone measurement.
- Meadow `check/meadow-epic` records that frame preparation was not the phone stutter. It does not publish a phone FPS.

## Opening a candidate

All paths are under the static server above. Nothing here is the live meadow.

| Candidate | URL | Flag |
|---|---|---|
| Crystal canyon, passes off | `/engine/webgpu/crystal/crystal.html?candidate=materials-v2-r2` | Without `candidate=materials-v2-r2` the page stays on HOLD and does not draw. `fx` omitted or `fx=off`. |
| Crystal TAA | same page | `?candidate=materials-v2-r2&fx=taa` |
| Crystal SSGI | same page | `?candidate=materials-v2-r2&fx=ssgi` |
| Crystal TAA and SSGI | same page | `?candidate=materials-v2-r2&fx=both` |
| TAA/SSGI math bench | `/engine/webgpu/m449cand.html` | Separate page. The meadow does not import it. Quartz F0 0.04, no fog, no chrome. |
| Obsidian Reach | `/engine/webgpu/reach/reach.html` | `?run=1` scripted gallop. `?debug=1` position line. |
| Glacier abyss dawn | `/engine/webgpu/glacier/glacier.html?candidate=glacier-abyss-dawn` | Without that query the page does not draw the world. |
| Paw stance lock | `/engine/webgpu/candidates/foot-lock/index.html` | `?play=1` keyboard. `?biome=canyon` stride only. `?lock=0` skating baseline. |
| Meadow breath / pace / diag | `/engine/webgpu/m448aaa3.html` and the `*-install` pages | Not `m448aaa2`. |

Hold to run on the crystal and reach pages. A and D yaw.

## House rules

- **Imagine pixels, real colour.** Material tiles are Imagine images used in their own colour. The shader multiplies by one declared light. It does not recolour a tile to pass CIE76. A reference key is not a texture. A procedural sky is house code and is not sold as an Imagine plate.
- **No outside model.** This engine path does not call MoGe, SAM, or any other outside vision model. The orchestrator under `tools/boltverse-orchestrator/` only reads the in-house registry and returns a mock or `NO AI YET`. It does not load a checkpoint.
- **No fog on the meadow.** `m448aaa2` does not import `engine/fog.js`. That helper defaults to haze 0 and is documented as an identity mix for the meadow. The foot-contact brick does not draw fog. The glacier page sets fog off. The isolated TAA bench sets `fog: 0`.
- **Crystal is not chrome.** Canyon specular is albedo times the highlight at weight 0.06. The isolated bench uses dielectric F0 0.04. Neither path paints a chrome lobe.

## Orchestrator

`tools/boltverse-orchestrator/` is a read-only router for the in-house registry. Default routing uses `validated` entries only. Failed, superseded, and missing weights are not called. It does not train, does not open a network, and does not edit the registry.

```bash
python3 -m pytest tools/boltverse-orchestrator/tests
```
