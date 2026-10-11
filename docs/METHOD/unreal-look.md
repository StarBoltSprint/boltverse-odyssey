# Unreal look — `tools/look`

Phone look pack for every biome. It sits on the lighting module ([lighting-atmosphere.md](lighting-atmosphere.md)) and on law 67. The 2026-10-11 step adds baked light, an environment on metal and glass, mover-only shadows, and god-ray cards. Those stay off the live tree until a person swaps them.

## Order

Each feature is its own module, its own URL flag, and its own fps row. `look.py` loads a module only when the file exists.

| # | Module | Flag | What it writes |
|---|---|---|---|
| 1 | `grade.py` | `?grade=` `?bloom=` | ACES or AgX, chosen by the smaller CIEDE2000 distance to the key. Quarter-res bloom. A 16³ LUT sampled from the key's Lab bands. |
| 2 | `bake.py` | `?bake=` | Ground albedo multiplied by an AO taken from the normal plate and a sand bounce sampled from the key. Cycles script `cycles_bake.py` is the uv2 / lightMap path. |
| 3 | `envmap.py` | `?env=` | Equirect to PMREM. Intensity on metal and glass only. Left/right seam and pole pinch reject a bad pano. |
| 4 | `fog.py` | `?fog=` | Height fog. The three band colours are mean rectangles of the key. |
| 5 | `shadows.py` | `?shadows=` | Static meshes do not cast. PCF soft map ≤ 1024 only when a mover is in the scene. Neutral, not tinted. |
| 6 | `sprites.py` | `?sprites=` | Existing Imagine god-ray cards aimed at the key sun. Overdraw capped. |

`?look=0` turns the pack off. `?grade=1` forces one feature on.

## Rules

- No typed colour. `python3 tools/look/colour_check.py` fails a hex, an rgb function, or a `0x` colour that is not neutral black or white on a line that says `neutral`. A LUT or a bake plate is pixels from an Imagine image. A curve file may start with `not a colour`.
- Shadows stay a neutral dark. The tool does not write a shadow tint.
- Phone budget is `tools/perf` `PHONE` (v62 mode B): fps average ≥ 30, 1% low ≥ 20, frame ≤ 1000/30 ms, draw calls ≤ 150, textures ≤ 256 MiB. SwiftShader frame time is informational. A feature still ships OFF when its frame time grows by more than 2 ms and more than 15% of the baseline, or when draw calls or textures miss the cap.
- The live preview is never edited. `stage.py` symlinks a copy and writes only `main.mjs`, `index.html`, and `look/` inside the stage directory.
- Imagine generation is off. Requests go to `imagine-requests.json` with status `NEEDS_APPROVAL`.

## Run for a new biome

```
python3 tools/look/look.py build \
  --key KEY.jpg --out DIR \
  --sky SKY-EQUIRECT.jpg --light key-light.json --plates GROUND_DIR
python3 tools/look/look.py install --live LIVE --stage STAGE
python3 tools/look/selftest.py
```

`tools/lighting/light_key.py apply` calls the same build into `<stage>/look/` and ignores a failure. The imagine-to-3d stage `look` (just before `report`) does the same when the spec has a key, and records SKIP when it does not.

The page reads `./look/look.json`. Flags: `?hud=0&lockq=1&dyn=0` keep the phone bench on one camera path (`?bench=1`).

```
node tools/look/bench.mjs <url> <out.json> [shot.png]
```

That bench is one headless Chrome at 540×1200 with deviceScaleFactor 2. `sheet.py` composes the phone contact sheet from the stills.

## Budget and the key

`budget.py` is the v62 mode B table. `grade.py` `distance` is mean CIEDE2000 at width 96. Layout IoU is a different gate; this pack is scored on colour distance to the key.
