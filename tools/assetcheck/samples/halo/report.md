# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

## halo.png

Kind `cutout`. Asset **FAIL**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGBA`
- width: `180`
- height: `240`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[180, 240]`
- onScreen: `[40.0, 50.0]`
- mask: `{'width': 155, 'height': 155, 'area': 18733, 'rows': [43, 197], 'cols': [13, 167], 'fillHeight': 0.6458, 'fillArea': 0.4336}`
- compared: `mask`
- magnification: `0.3226`
- magnificationLimit: `1.0`

### alpha — FAIL

- key: `alpha`
- alphaMin: `0`
- alphaMax: `255`
- unkeyedBlackFraction: `0.0`
- plateFraction: `1.0`
- plateColor: `[200.0, 80.0, 0.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `1.0`
- haloThicknessPx: `10.6789`
- FAIL alpha solid background plate fraction=1.0000 rectangularity=1.000
- FAIL alpha halo thickness=10.68px limit=3.0

## Failures

- halo.png: FAIL alpha solid background plate fraction=1.0000 rectangularity=1.000
- halo.png: FAIL alpha halo thickness=10.68px limit=3.0

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
