# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## lock/plate.png

Kind `cutout`. Asset **WARN**.

Grandfathered (`lock/`). Owner KEEP. Do not recook or replace this file because of a WARN.

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
- onScreen: `[40.0, 60.0]`
- mask: `{'width': 101, 'height': 141, 'area': 10973, 'rows': [90, 230], 'cols': [50, 150], 'fillHeight': 0.4406, 'fillArea': 0.1715}`
- compared: `mask`
- magnification: `0.4255`
- magnificationLimit: `1.0`

### alpha — WARN

- key: `undeclared-black`
- alphaMin: `255`
- alphaMax: `255`
- unkeyedBlackFraction: `0.8285`
- plateFraction: `0.8285`
- plateColor: `[0.0, 0.0, 0.0]`
- plateTouchesFrame: `True`
- plateRectangularity: `0.8285`
- haloThicknessPx: `0.0`
- WARN alpha unkeyed near-black fraction=0.8285 limit=0.02
- WARN alpha cutout has an opaque black field and no alpha; declare key=black or key the plate
- WARN alpha solid background plate fraction=0.8285 rectangularity=0.829

## banded.jpg

Kind `still`. Asset **FAIL**.

### basic — FAIL

- codec: `jpeg`
- container: `jpg`
- pixFmt: `None`
- mode: `RGB`
- width: `160`
- height: `96`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `False`
- losslessRequired: `True`
- bandingFraction: `0.0`
- FAIL basic lossless required, codec=jpeg container=jpg

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[160, 96]`
- onScreen: `[80.0, 40.0]`
- mask: `{'width': 160, 'height': 96, 'area': 15360, 'rows': [0, 95], 'cols': [0, 159], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `0.5`
- magnificationLimit: `1.0`

## Failures

- banded.jpg: FAIL basic lossless required, codec=jpeg container=jpg

## Warnings

Informational. Not a recook order.

- lock/plate.png: WARN alpha unkeyed near-black fraction=0.8285 limit=0.02
- lock/plate.png: WARN alpha cutout has an opaque black field and no alpha; declare key=black or key the plate
- lock/plate.png: WARN alpha solid background plate fraction=0.8285 rectangularity=0.829

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
