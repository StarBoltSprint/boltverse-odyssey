# tools/keysheet — key feature sheets (any zone, fully local)

1. Author `zones/<zone>.json`: every visible element of the key (id, kind, `what` = shape/thickness/colour/position,
   box = SAM2 prompt + search window as key fractions, params, pass rule). Kinds: region | band | dark_rect | drips | straight_bar.
2. `python3 tools/keysheet/extract.py zones/<zone>.json KEY.jpg zones/<zone>/` -> SAM2 (sam2.1 hiera small via
   /workspace/.venv-sam2) element masks + `sheet.json` (bbox/area/centroid/Lab colour + detector values measured on the key).
3. `python3 tools/keysheet/check.py RENDER.png zones/<zone>/sheet.json` -> one blocking row per element.
4. gatesuite: build.json `"keysheet": "tools/keysheet/zones/<zone>/sheet.json"` -> section `keyfeatures` (missing = FAIL).
Selftest: `python3 tools/keysheet/selftest.py` (the key must pass its own sheet).

## Automatic whole-key sheet (v4, zero setup)

The hand list (`zones/zd-terrace.json`) is now **regression only** (`regress.py`: the auto sheet must find every hand element).
Judging uses the automatic sheet:

```
# once per key (cached; SAM2.1 AMG + MoGe-2 run in the torch venv, the rest in system python)
python3 tools/keysheet/auto_extract.py KEY.jpg OUT/autosheet-<zone> [--pps 64]
# per render (key camera, same 1024 frame): staged L1 -> L2 -> L3, worst region blocks
python3 tools/keysheet/auto_check.py RENDER.png OUT/autosheet-<zone> [--scope MASK.png] [--review sbs.jpg]
python3 tools/keysheet/regress.py OUT/autosheet-<zone>          # hand Zone D list found by the auto sheet
python3 tools/keysheet/selftest_auto.py OUT/autosheet-<zone>    # key passes; 5 generated must-fail edits fail
```

* **L1 big forms** (~10): k-means on (CIELAB, log MoGe depth), small components absorbed into neighbours (>= 3 % of frame).
  Scored on outline recall (render edges on the form outline vs the key's), mean colour dE, snow fraction.
* **L2 elements** (hundreds): SAM2 automatic masks 12 px .. 1.5 % of frame, plus bright colour-cluster components, plus a
  local top-hat snow detector (small snow patches on stones / ledges = facade snow), plus a drip detector (icicles).
  Each is scored where it is in the key frame: the same class detector runs on key and render inside the element's
  grown mask -> coverage IoU, location, thickness, silhouette roughness, straightness, colour (snow/ice/drip), or
  colour, edge density and snow fraction (stone/dark/sky).
* **L3 fine detail**: not per element; 32 px tile statistics (high-pass std, orientation entropy, FFT peak, L std)
  inside each L1 form compared as distributions, plus DINOv2 patch cosine per form (DINO only runs once L1+L2 are green).
* Classes are relative to the key itself (snow = top 15 % L, ice = top 10 % green-cyan a*, sky = farthest depth or
  top-touching), so any key works without setup.
* Must-fail fixtures are generated at test time from the key (no JPGs in git).
