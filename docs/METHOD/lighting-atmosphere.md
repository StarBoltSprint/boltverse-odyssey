# Lighting and atmosphere from the key: `tools/lighting/light_key.py`

The tool measures the key image, fits engine parameters, applies them to **staging only**, and checks the result with key-compare.

Rules:
- Every colour is sampled from the key pixels; none are typed.
- Halo, god-rays, dust and fog keep their Imagine textures (`sky1/sky7-atlas.png`, dust plates). This module never tints a sprite.
- New Imagine images are never generated. List them for SmiR's approval instead.

## Parameters exposed in staging
`kc_stage.py` writes staging copies of `index.html` (with a loader for `kc-light.json`), `objects-t7.mjs` and `biome.json`:

| kc-light key | engine target |
|---|---|
| `sunAzimuthDeg`, `sunElevationDeg` | objects-t7 SUN_AZIMUTH / SUN_ELEVATION (sun light and shadow direction) |
| `sunHex`, `sunIntensity` | objects-t7 DirectionalLight |
| `hemiSky`, `hemiGround`, `hemiIntensity` | objects-t7 HemisphereLight (fill) |
| `chromeGraphite` | objects-t7 `uZbGraphite` (USE_ZB_CHROME_BODY dark side, i.e. the **spire shadow**) |
| `biome: {"sun.azimuthDeg", "sun.elevationDeg", "sun.hex", "fog.color", "fog.bands"}` | biome.json (sky dome sun, halo sprite position, fog) |
| kc-params `fogW`, `hazeW` | mesas-v11 per-object haze weights |

## Measurements on the key (`measure`)
- **Sun:**
  - position: the centroid of the brightest blob, converted to azimuth and elevation through the solved key camera (YXZ, from `camera-v2.json`);
  - core colour;
  - halo colour: the bright half of the 2-6 R annulus, so occluders are excluded;
  - halo radial L profile.
- **Sky gradient:** Lab per 5 % row of the top-connected sky.
- **Haze:** the colour in the avenue vanishing gap.
- **Fog density by distance:** the fog fraction of the darkest tower pixels in each composition slot, plotted against that slot's distance, then fit to 1 - exp(-d/D).
- **Shadow:** the darkest 20 % of ground rows 0.65-1. This gives L* (darkness) and a*/b* (tint). The rule "dark, neutral, slight cool" is checked as `neutralCool`.

## Commands (per biome)
```
cd tools/lighting
R=RUN/light; CAM=RUN/camera/camera-v2.json      # from placement_v2.py camera
python3 light_key.py measure --key KEY.jpg --camera $CAM --out $R [--composition ../imagine-to-3d/layouts/<biome>-composition.json]
python3 light_key.py fit --measure $R/key-light.json --out $R [--kc LAST/key-compare.json]
python3 light_key.py test  --camera $CAM --out $R/before --elements sun       # one render
python3 light_key.py apply --proposal $R/kc-light-proposal.json --only sun   # staging kc-light.json
python3 light_key.py test  --camera $CAM --out $R/after  --elements sun       # one render
```
- Apply **one group at a time**, in this order: sun, then hemi, then graphite, then mesaHaze, then fog.
- After each group, run `test` with the elements it affects:
  - sun: `sun`
  - graphite: `spire` (shadow ΔE)
  - mesaHaze and fog: `mesas` (lit ΔE)
- Keep a group only if its metric improves. A sun group is a keep when the sun element is no longer MISSING and its IoU goes up.
- To revert a group, delete its keys from `<stage>/kc-light.json` and run `python3 -c "import kc_stage; kc_stage.write_light_files(LIVE, STAGE)"`, or simply re-apply the other groups.

## Going live (Grok Build, coordinated)
The tool writes staging copies only. A live swap has to carry the same values into three places:
- objects-t7 constants;
- biome.json;
- the mesas opts.

Each needs a version bump. `chromeGraphite` and the mesa haze weights are shared with other biomes, so live needs a per-biome parameter, not a constant edit.

## Honest limits
- The sun elevation depends on the solved camera pitch. A camera stuck at a bound (fov 80) biases it.
- Fog density from a painted key is weak evidence. The key keeps backlit silhouettes dark at 280 m, so D comes out around 1.6-2 km, far lighter than the game bands (0.45 at 130 m). Apply fog last, and only if the mesas lit ΔE improves.
- `fit --kc` corrections (graphite, mesa haze) are one proportional step, clipped to ×0.3..×3. Re-run them once after applying.
