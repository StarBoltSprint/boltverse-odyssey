# assetcheck

Result: **FAIL**

Screen 720×1600. WebGL max texture 4096.

A hand-written PASS is not a PASS. This file is the gate.

A WARN on a file under `lock/`, or on a manifest entry with `locked: true`, is informational. It is not a FAIL, it does not fail this run, and it is not a reason to recook or replace that file. Bolt stays `lock/bolt-gallop-cycle.mp4` and `lock/bolt-idle-breath.mp4`.

## ../../../../biome/void-orbit/stills/ship-depth.png

Kind `still`. Asset **FAIL**.

### basic — PASS

- codec: `png`
- container: `png`
- pixFmt: `None`
- mode: `RGBA`
- width: `192`
- height: `108`
- fps: `None`
- frames: `None`
- durationSec: `None`
- lossless: `True`
- losslessRequired: `True`
- bandingFraction: `0.0`

### resolution — FAIL

- screen: `[720, 1600]`
- frame: `[192, 108]`
- onScreen: `[200.0, 200.0]`
- mask: `{'width': 192, 'height': 108, 'area': 20736, 'rows': [0, 107], 'cols': [0, 191], 'fillHeight': 1.0, 'fillArea': 1.0}`
- compared: `frame`
- magnification: `1.8519`
- magnificationLimit: `1.0`
- FAIL resolution magnification=1.8519 limit=1.0 source=192x108 rows=0-107 frame=192x108 onScreen=200x200 fillHeight=1.0000

## Failures

- ../../../../biome/void-orbit/stills/ship-depth.png: FAIL resolution magnification=1.8519 limit=1.0 source=192x108 rows=0-107 frame=192x108 onScreen=200x200 fillHeight=1.0000

## Heuristics

- The tool only measures. It does not repaint, resize, or replace the source.
- Loop optical flow is coarse block matching on a downscale, not a learned flow model.
- Banding is a posterization heuristic (flat run, then a step). Noise can hide bands.
- A declared key (black or green) is trusted as the compositor key. Undeclared cutouts must carry alpha.
- Magnification uses the declared on-screen size at the closest camera on a 720×1600 portrait.
- A hand-written PASS is not a PASS. The exit code and this file are the gate.
- Anything under lock/ or marked locked: true is grandfathered owner KEEP. The same measurements run. A miss is WARN, never FAIL, and does not change the exit code. A WARN is not a reason to recook or replace that file. Bolt stays lock/bolt-gallop-cycle.mp4 and lock/bolt-idle-breath.mp4.
