# tools/kit/viewer — play viewer + real-browser review sheet

`play.html` shows a kit GLB the way the game does. It uses three.js, with hex-triplanar basalt from the
material library, the snow tile mixed in by the per-vertex `_SNOW` attribute, and a matte ice material on the icicles
(`_ICE`). The ground is the library snow tile at the wall foot plus the Zone D ground plate `zd-g-snow-a`. Zone B
`mesaA.glb` stands next to the tier for scale. The camera is the spine v1.3.1 phone camera (assumed): 412x915 CSS at
1.5 DPR, vfov 48.
Views (`?view=`): `key` (MoGe key camera), `3m`, `chase` (7.5 m), `45` (45° at 4 m), `grazing`, `side` (cornice side view),
`scale`. The HUD and `window.__probe` report the live screen px/m at the centre hit and the texture px/m.

Serve a folder that holds play.html, hexTriplanar.js, three.module.js, jsm/, model.glb, mesaA.glb and tex/.
three.js and the large assets are not committed. Then run:

    python3 tools/kit/viewer/capture.py http://127.0.0.1:8962 OUT --chrome /usr/bin/google-chrome

This runs headless Chrome with WebGL through SwiftShader and writes `OUT/view-*.png`, `OUT/probes.json` and `OUT/review-sheet.jpg`.
