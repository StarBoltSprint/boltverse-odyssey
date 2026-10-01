# assetcheck

Result: **PASS**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## tile-0.png

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

### tiling — PASS

- exposureDelta: `0.0036`
- contrastRatio: `1.0019`
- crossSeam: `[7.026, 7.1042, 7.0781, 3.6589]`
- limits: `{'seamRatio': 2.2, 'seamAbs': 12.0, 'exposureDelta': 18.0}`

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

### tiling — PASS

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

### tiling — PASS

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

### tiling — PASS

- sharedWith: `tile-0.png`

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
