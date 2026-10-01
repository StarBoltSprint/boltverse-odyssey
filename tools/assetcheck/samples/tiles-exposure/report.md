# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

## tile-0.png

Kind `tile`. Asset **FAIL**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGB`
- width: `64`
- height: `64`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[64, 64]`
- onScreen: `[48.0, 48.0]`
- mask: `{'width': 64, 'height': 64, 'area': 4096, 'rows': [0, 63], 'cols': [0, 63], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `0.75`
- magnificationLimit: `1.0`

### tiling — FAIL

- exposureDelta: `53.2079`
- contrastRatio: `1.367`
- crossSeam: `[6.0729, 6.0729, 59.7917, 54.849]`
- limits: `{'seamRatio': 2.2, 'seamAbs': 12.0, 'exposureDelta': 18.0}`
- FAIL tiling exposure delta=53.21 limit=18.0 (checkerboard risk)
- FAIL tiling cross-seam tile-2.png|tile-3.png mae=59.79
- FAIL tiling cross-seam tile-3.png|tile-0.png mae=54.85

## tile-1.png

Kind `tile`. Asset **PASS**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGB`
- width: `64`
- height: `64`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[64, 64]`
- onScreen: `[48.0, 48.0]`
- mask: `{'width': 64, 'height': 64, 'area': 4096, 'rows': [0, 63], 'cols': [0, 63], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `0.75`
- magnificationLimit: `1.0`

### tiling — FAIL

- sharedWith: `tile-0.png`

## tile-2.png

Kind `tile`. Asset **PASS**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGB`
- width: `64`
- height: `64`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[64, 64]`
- onScreen: `[48.0, 48.0]`
- mask: `{'width': 64, 'height': 64, 'area': 4096, 'rows': [0, 63], 'cols': [0, 63], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `0.75`
- magnificationLimit: `1.0`

### tiling — FAIL

- sharedWith: `tile-0.png`

## tile-3.png

Kind `tile`. Asset **PASS**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGB`
- width: `64`
- height: `64`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — PASS

- screen: `[720, 1600]`
- frame: `[64, 64]`
- onScreen: `[48.0, 48.0]`
- mask: `{'width': 64, 'height': 64, 'area': 4096, 'rows': [0, 63], 'cols': [0, 63], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `0.75`
- magnificationLimit: `1.0`

### tiling — FAIL

- sharedWith: `tile-0.png`

## Failures

- tile-0.png: FAIL tiling exposure delta=53.21 limit=18.0 (checkerboard risk)
- tile-0.png: FAIL tiling cross-seam tile-2.png|tile-3.png mae=59.79
- tile-0.png: FAIL tiling cross-seam tile-3.png|tile-0.png mae=54.85

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
