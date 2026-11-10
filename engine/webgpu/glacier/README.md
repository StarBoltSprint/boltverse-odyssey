# Glacier abyss — isolated candidate

Frozen rift at dawn for the in-house WebGPU engine. Not live. Not a visual KEEP. Nothing here is merged by opening the page.

Open only with the flag:

`engine/webgpu/glacier/glacier.html?candidate=glacier-abyss-dawn`

The rift runs about 4.6 km. Ice walls vary from about 73 m to 188 m, inside the 60–200 m band. Geometry is displaced sheets, arches, icicle instances, and snow-drift instances. There are no box primitives. Albedo is in-house procedural ice and snow in real colour. The dawn rig is `dawn-light.json`, one record for every material. The sky is a world-direction function. Fog is off.

Bolt is the live `bolt439` card at the meadow follow size (1.15 m card, centred).

Gates, unchanged:

| Gate | Limit | Negative control |
| --- | --- | --- |
| Rendered CIE76, lightness included | 10 | A darkened wall must block |
| Sky, one world direction across cameras | 0.015 | A screen-space sky must fail |
| Pure black | 0.0003 | An injected tear must fail |
| Grid peak | 1.8 | An injected grating must fail |
| Enclosed hole, depth inside a wall | 0 | A punched pixel must fail |
| Triangles | 200000 | |
| Draws | 12 | |

Phone budget from `test-cpu.mjs` is the committed mesh, not a lowered cap.

Imagine tiles: `test-texel-density.mjs`. Snow and ice each use four native 1024×1024 stills. Each still covers 0.5 m, which is 2048 px per metre, mixed by a hex blend so the repeat is not a grid. Large form comes from the mesh, the dawn rig, and a low-frequency tint. UV is an orthonormal face frame, so stretch stays at or under 1.3. Mips and anisotropic filtering stay on. A 1024 px image declared at 1 m must fail, and stretch 1.31 must fail. The planet is one equirectangular still and is gated on on-screen magnification at its displayed size, not on px per metre. The limit is not lowered, and a short tile is not faked with an upscale or with procedural pixels.

Run 3 filters the Imagine photographs with a mip chain, anisotropic sampling, derivative LOD, hex tiling, and a two-scale blend. Wall scale is larger than the snow scale. The walls are strata with ledges, fracture columns, and meltwater grooves. The arches are thick faceted bridges with icicles underneath. The far land is a glacier plateau meeting the wall rims, with ridgelines sat on that surface. `test-film-grid.mjs` scores every chase frame. On the run 3 film, 151 of 300 frames are over the grid limit 1.8 (min 1.163, mean 1.971, max 6.090). The limit was not lowered. The live Bolt card sits in that measurement band; the dog was not smeared and no screen vignette was added to move the score.
