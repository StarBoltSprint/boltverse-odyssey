# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## frozen.mp4

Kind `loop`. Asset **FAIL**.

### basic — PASS

- codec: `h264`
- container: `mp4`
- pixFmt: `yuv444p`
- mode: `None`
- width: `64`
- height: `96`
- fps: `8.0`
- frames: `10`
- durationSec: `1.25`
- lossless: `False`
- losslessRequired: `False`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[64, 96]`
- onScreen: `[16.0, 20.0]`
- mask: `{'width': 33, 'height': 33, 'area': 797, 'rows': [32, 64], 'cols': [14, 46], 'fillHeight': 0.3438, 'fillArea': 0.1297}`
- compared: `mask`
- magnification: `0.6061`
- magnificationLimit: `1.0`

### alpha — PASS

- key: `green`
- alphaMin: `255`
- alphaMax: `255`
- plateFraction: `0.8703`
- plateColor: `[0.0, 255.0, 1.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `0.8703`
- haloThicknessPx: `0.0`
- edgeGreenFraction: `0.0`
- edgeBandPx: `3`
- greenSpillFraction: `0.0`
- greenFieldStd: `0.0`

### loop — FAIL

- fps: `8.0`
- frames: `10`
- durationSec: `1.25`
- seamMAE: `0.0`
- seamP95: `0.0`
- seamFlowPx: `0.0`
- medianFrameMAE: `0.0`
- popLimit: `18.0`
- popFrames: `[]`
- frozenHits: `6`
- limits: `{'seamMAE': 8.0, 'seamP95': 28.0, 'seamFlowPx': 2.0, 'frozenSec': 0.4}`
- FAIL loop frozen section ending near diff 3 (0.4s below MAE 0.45)

## Failures

- frozen.mp4: FAIL loop frozen section ending near diff 3 (0.4s below MAE 0.45)

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
