# Real 3D, tested on the crashed ship

> **Superseded (2026-10-03, [`docs/METHOD.md`](../../docs/METHOD.md)): do not use TripoSR** or any single-image mesh network as a shape source (Golden rule: no TripoSR-style mesh generators; it invents unseen sides). Shapes come from Imagine images (8-view carving, or the hard-object measured-section method, IN TEST). Sampling: **use mipmaps per law 65** (`LINEAR_MIPMAP_LINEAR`, never `NEAREST`), not "nearest, no mipmaps". Kept as a measurement record; tool code unchanged; fix tracked for the tool loop.

Invisible shape, Imagine pixels. Code does not draw colour, lights, shadows, or a texture.

An image-to-3D network sees one still and invents the sides it did not see. That invention is allowed only as the invisible shape. A surface the orbit cannot cover with a real Imagine view stays transparent. The ship is half-buried so the belly, which no still shows, is not on screen.

## Command

```bash
python3 tools/mesh3d/selftest.py
python3 tools/mesh3d/build.py --views tools/mesh3d/inputs/ship --out tools/mesh3d/out --engine auto
```

`--engine visual-hull` skips the network. `--engine triposr` does not fall back. `auto` tries TripoSR once and, if that mesh will not line up with the stills, keeps the visual hull and says so in `out/qc/report.json`.

The viewer is `tools/mesh3d/viewer/index.html` (serve `tools/mesh3d` and open it). It is unlit. Sampling is nearest from the original PNGs. Weight is `cos` of the yaw gap, and zero past 45°. `?bury=0` shows the unburied mesh, including transparent holes. Phone size is 720×1600.

```bash
node tools/mesh3d/shot.mjs
```

## Cameras

Level keel. Elevation **18°**, the elevation stored on the KEEP hero chain (`learn/recipes/hull-ship-xai-starship-hero.md`). A new turnaround uses +15° (`learn/geometry.md`). These stills were not recooked. Horizontal field **24°** (85 mm class, rail 12). Imagine did not store a measured focal length, so 24° is the class, not a surveyed lens. One distance for every photo. The phone orbit may sit further back so magnification stays ≤ 1. Every orbit yaw shares that further distance.

Shape votes use yaws 0, 90, 180, 270. Colour uses 0, 45, 90, 180, 270, 315 (front, 3/4, side, back, and the mirrors). Yaw 135 and 225 are the drifted rear quarters and are not sources. The orbit still looks from those angles, and coverage there is whatever 90 and 180 (or 180 and 270) can see at the 45° edge.

## What is invisible

`ship.obj` and `ship.glb` have positions, normals, and indices. No vertex colour, no material colour. `coverage.npz` stores per-face flags and the per-frame visible/covered counts. Frame alpha is the per-texel flag: 255 is a real Imagine blend, 0 is empty or uncovered. Uncovered is never filled.

The visual hull dilates each silhouette and keeps a voxel when 3 of 4 agree. That is the tolerance for the known view drift. It does not invent a colour for the gap.

TripoSR, when the weights and the CPU stack are present, runs on `yaw-000.png` (it has an alpha; `hero.png` is an unkeyed plate). The network’s own vertex colours are discarded. `torchmcubes` is not required. The density grid is meshed with surface nets. The mesh is then yaw-and-scale aligned to the four silhouettes.

## Pixels

Do not enlarge a source. The phone measure is the hull’s projected box in 720×1600 pixels divided by that still’s silhouette box. Above 1 the build pulls the orbit back. Above 1 after that pull is `FAIL upscale`.

## This ship

The measurement is `learn/take-notes/2026-10-02-ship-real3d.md`. TripoSR on `yaw-000` (CPU, resolution 48) aligned at silhouette IoU 0.445. Screen coverage of the above-ground surface averages 0.703 and bottoms at 0.618. Max magnification is 0.976. Weights stay outside the repo (`triposr_status` says when they are missing). The visual hull is the fallback.
