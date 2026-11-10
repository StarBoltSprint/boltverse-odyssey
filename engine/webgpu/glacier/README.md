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
