# assetcheck

Result: **PASS**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

## loop.mp4

Kind `loop`. Asset **PASS**.

### basic — PASS

- codec: `h264`
- container: `mp4`
- pixFmt: `yuv444p`
- mode: `None`
- width: `64`
- height: `96`
- fps: `12.0`
- frames: `12`
- durationSec: `1.0`
- lossless: `False`
- losslessRequired: `False`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[64, 96]`
- onScreen: `[20.0, 24.0]`
- mask: `{'width': 37, 'height': 37, 'area': 1009, 'rows': [30, 66], 'cols': [14, 50], 'fillHeight': 0.3854, 'fillArea': 0.1642}`
- compared: `mask`
- magnification: `0.6486`
- magnificationLimit: `1.0`

### alpha — PASS

- key: `green`
- alphaMin: `255`
- alphaMax: `255`
- plateFraction: `0.8358`
- plateColor: `[0.0, 255.0, 1.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `0.8358`
- haloThicknessPx: `0.0`
- greenSpillFraction: `0.0`
- greenFieldStd: `0.0`

### loop — PASS

- fps: `12.0`
- frames: `12`
- durationSec: `1.0`
- seamMAE: `2.0512`
- seamP95: `0.0`
- seamFlowPx: `0.1685`
- medianFrameMAE: `1.3736`
- popLimit: `18.0`
- popFrames: `[]`
- frozenHits: `0`
- limits: `{'seamMAE': 8.0, 'seamP95': 28.0, 'seamFlowPx': 2.0, 'frozenSec': 0.4}`

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
