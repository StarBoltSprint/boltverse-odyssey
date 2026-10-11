# Grok-native tower

One slab, the broad tower just left of the road centre (`zoneb-tower-hero`). No new Imagine images. MoGe-2 and SAM2 run only as the baseline.

```bash
python3 tools/grok-native/selftest.py
python3 tools/grok-native/run.py
```

Inputs default to `/workspace/grok-native-1011/imagine/`. Work lands in `steps/grok-native-1011/work/`. The sheet and `REPORT.md` land in `steps/grok-native-1011/`.

Stages: scale 0.714 and ORB+ECC register (`WARP_INVERSE_MAP`), Grok vision on `https://api.x.ai/v1/chat/completions`. A free-form box is recorded, then vision picks one numbered structure proposal. GrabCut and an edge snap run inside that box, with at most two overlay checks. Photometric stereo plus a clay prior, Frankot-Chellappa, a Blender watertight slab with the key projected, at most three render checks. A second solid is the parametric prism (measured outline, one bite, no dense relief). The baseline is `tools/common/vision_models.py` (`mask_sam2`, `depth_moge`) under `/workspace/.venv-sam2/bin/python`. Set `GROK_NATIVE_REPERCEIVE=1` to call the free-form pass again.

`tower.js` is the same slab in the three.js position layout. `node tools/grok-native/tower.js slab.json` must match the Python positions.
