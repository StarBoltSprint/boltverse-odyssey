# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

## ../../../../lock/bolt-gallop-cycle.mp4

Kind `loop`. Asset **FAIL**.

### basic — PASS

- codec: `h264`
- container: `mp4`
- pixFmt: `yuv420p`
- mode: `None`
- width: `768`
- height: `1168`
- fps: `96.0`
- frames: `534`
- durationSec: `5.5625`
- lossless: `False`
- losslessRequired: `False`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[768, 1168]`
- onScreen: `[180.0, 280.0]`
- mask: `{'width': 192, 'height': 580, 'area': 69411, 'rows': [318, 897], 'cols': [284, 475], 'fillHeight': 0.4966, 'fillArea': 0.0774}`
- compared: `mask`
- magnification: `0.9375`
- magnificationLimit: `1.0`

### alpha — PASS

- key: `green`
- alphaMin: `255`
- alphaMax: `255`
- plateFraction: `0.911`
- plateColor: `[32.0, 250.0, 26.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `0.911`
- haloThicknessPx: `0.0`
- greenSpillFraction: `0.0553`
- greenFieldStd: `1.8306`

### loop — FAIL

- fps: `96.0`
- frames: `534`
- durationSec: `5.5625`
- seamMAE: `4.6305`
- seamP95: `33.0`
- seamFlowPx: `2.0855`
- medianFrameMAE: `1.2448`
- popLimit: `18.0`
- popFrames: `[]`
- frozenHits: `0`
- limits: `{'seamMAE': 8.0, 'seamP95': 28.0, 'seamFlowPx': 2.0, 'frozenSec': 0.4}`
- FAIL loop seam p95=33.000 limit=28.0
- FAIL loop seam flow=2.085px limit=2.0

## Failures

- ../../../../lock/bolt-gallop-cycle.mp4: FAIL loop seam p95=33.000 limit=28.0
- ../../../../lock/bolt-gallop-cycle.mp4: FAIL loop seam flow=2.085px limit=2.0

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
