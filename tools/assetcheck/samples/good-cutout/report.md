# assetcheck

Result: **PASS**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

## good-cutout.png

Kind `cutout`. Asset **PASS**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGBA`
- width: `200`
- height: `320`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[200, 320]`
- onScreen: `[80.0, 120.0]`
- mask: `{'width': 141, 'height': 221, 'area': 24173, 'rows': [40, 260], 'cols': [30, 170], 'fillHeight': 0.6906, 'fillArea': 0.3777}`
- compared: `mask`
- magnification: `0.5674`
- magnificationLimit: `1.0`

### alpha — PASS

- key: `alpha`
- alphaMin: `0`
- alphaMax: `255`
- unkeyedBlackFraction: `0.0`
- plateFraction: `0.6223`
- plateColor: `[0.0, 0.0, 0.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `0.6223`
- haloThicknessPx: `0.0`

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
