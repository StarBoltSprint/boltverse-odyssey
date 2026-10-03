# Real 3D, tested on the crashed ship

Invisible shape, Imagine pixels. Code does not draw colour, lights, shadows, or a texture.

The play shape is the visual hull carved from the Imagine stills. TripoSR is not a shape source (golden rule, 2026-10-02: no TripoSR-style mesh generators). It runs only with `--experiment triposr`, and that mesh is not written into the play asset. 8-view carving (`tools/walkaround`) and the hard-object measured-section method (VALIDATED 2026-10-03) stay the Imagine-derived shape paths.

A surface the orbit cannot cover with a real Imagine view stays transparent. The ship is half-buried so the belly, which no still shows, is not on screen. The play viewer samples the stills with `LINEAR_MIPMAP_LINEAR` and mipmaps (law 65). QC frames from `shade.py` are a measurement buffer, not the play view.

## Command

```bash
python3 tools/mesh3d/selftest.py
python3 tools/mesh3d/build.py --views tools/mesh3d/inputs/ship --out tools/mesh3d/out --engine visual-hull
```

`--engine auto` is the same visual hull. It does not call TripoSR. `--experiment triposr` records a network mesh under `qc/` with `feedsPlay: false` and does not replace `ship.obj`.

The viewer is `tools/mesh3d/viewer/index.html` (serve `tools/mesh3d` and open it). It is unlit. Imagine stills use `LINEAR_MIPMAP_LINEAR` and mipmaps. The depth target is a measurement z buffer. Weight is `cos` of the yaw gap, and zero past 45°. `?bury=0` shows the unburied mesh, including transparent holes. Phone size is 720×1600. `node tools/playcheck/src/renderlint.mjs tools/mesh3d/viewer/main.js` stays clean.

```bash
node tools/mesh3d/shot.mjs
```

## Cameras

Level keel. Elevation **18°**, the elevation stored on the KEEP hero chain (`learn/recipes/hull-ship-xai-starship-hero.md`). A new turnaround uses +15° (`learn/geometry.md`). These stills were not recooked. Horizontal field **24°** (85 mm class, rail 12). Imagine did not store a measured focal length, so 24° is the class, not a surveyed lens. One distance for every photo. The phone orbit may sit further back so magnification stays ≤ 1. Every orbit yaw shares that further distance.

Shape votes use yaws 0, 90, 180, 270. Colour uses 0, 45, 90, 180, 270, 315 (front, 3/4, side, back, and the mirrors). Yaw 135 and 225 are the drifted rear quarters and are not sources. The orbit still looks from those angles, and coverage there is whatever 90 and 180 (or 180 and 270) can see at the 45° edge.

## What is invisible

`ship.obj` and `ship.glb` have positions, normals, and indices. No vertex colour, no material colour. `coverage.npz` stores per-face flags and the per-frame visible/covered counts. Frame alpha is the per-texel flag: 255 is a real Imagine blend, 0 is empty or uncovered. Uncovered is never filled.

The visual hull dilates each silhouette and keeps a voxel when 3 of 4 agree. That is the tolerance for the known view drift. It does not invent a colour for the gap.

`--experiment triposr`, when the weights and the CPU stack are present, runs on `yaw-000.png` (it has an alpha; `hero.png` is an unkeyed plate) and writes a side note. The network’s own vertex colours are discarded. That mesh is not the play hull. `torchmcubes` is not required. The density grid is meshed with surface nets only inside that experiment.

## Pixels

Do not enlarge a source. The phone measure is the hull’s projected box in 720×1600 pixels divided by that still’s silhouette box. Above 1 the build pulls the orbit back. Above 1 after that pull is `FAIL upscale`.

## This ship

The measurement is `learn/take-notes/2026-10-02-ship-real3d.md`. TripoSR on `yaw-000` (CPU, resolution 48) aligned at silhouette IoU 0.445. Screen coverage of the above-ground surface averages 0.703 and bottoms at 0.618. Max magnification is 0.976. That run is why the network is not a play shape. The checked-in `out/asset.json` is that record (`engine` `triposr`, `feedsPlay` false). A new build writes the visual hull. Weights stay outside the repo (`triposr_status` says when they are missing). The visual hull is the play mesh.
