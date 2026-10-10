# imagine-to-3d (Boltverse) — first run: Zone B sandstone mesas, 2026-10-09

Turns Imagine view plates (edits of ONE key crop) into a real 3D object + runtime projection data.
Design: Grok chat Q15 (/workspace/arch-research-1008/q15-imagine-to-3d.md), method docs/METHOD/objects-from-key-crops.md.
The code never paints rock: colour = Imagine plates byte-for-byte; geometry = silhouettes of the Imagine plates.

## Stages (run.py)
1. **plates** (Grok Build, `/workspace/grokcli/kit/run-step.sh`, own worktree): front = edit of the key crop; side/back/top =
   edits of the front ("same object, one axis change"); detail = edit of a rock-only crop. Plain flat background.
2. **hull.py** organic visual hull: for every height level, the x span (front, blended 50% with mirrored back) and z span
   (side) give a superellipse (p 3.4) shrunk by the top plate's radial outline -> terraced heightfield, flat cap.
   Silhouette gate: IoU of the hull outline vs each plate outline (>= 0.9).
3. **proj.py** 18 plate cameras (8 horizontal, 4 up-45, 4 down-45, top, bottom). Each sample:
   `col = c0 + (p.t)k, row = r0 - (p.v)k`, row mirror-wrapped into the plate's rock rows, col into that row's rock span
   (spans from the plate's own mask) -> never samples sky. Worst stretch 1/max(n.d) = 1.22.
4. **relief.py** band-pass luminance of each plate (dark = recess).
5. **blender_mesa.py** heightfield -> solidify -> voxel remesh 0.35 m -> displacement along normals from the SAME
   projection (wall 0.7 m, oblique 0.35, top 0.18, smoothed 2 rings) -> 3 LODs (60k/12k/2.5k) with split normals at 62 deg -> GLB.
6. **qc.py** tris, welded manifold check, projection stretch per LOD.
7. **GATE (mandatory, last)** `gate_local.py` until tools/object-gate lands (hook: `OBJECT_GATE_CLI=<cli.mjs>`, called as
   `node cli.mjs --spec gate-spec.json --json`, must return `{pass_all, rows:[{name,pass,value,limit,fix}]}`).
   Profiles: mesa / tower / rock. Rows: IoU, UV stretch, manifold, LOD0 tris, native Imagine px/m (detail excluded),
   repetition (twin placements), approach morph (LOD pop in phone px), grounding + static neutral shadows (runtime dump).
   On FAIL: auto-fix the fixable rows (LOD switch out, re-yaw/mirror twins, fewer LOD0 tris) and re-gate, max 3 rounds.
   **Only PASS is packaged.** `--force-export` exists for previews and is recorded as `exportedOnFail` in the json.
8. **package.py** copies plates byte-identical, writes `<name>.json` (plate cameras, spans, gains, footprints, qc, gate).

```
python3 run.py --plates plates-all.json --type mesa --height 45 --name mesaA \
  --work /workspace/mesa-1009/work --dest /workspace/zb-preview-1008/mesas --placements placements.json --blender '{"sharpDeg":62}'
node ../mesa-dump.mjs "http://127.0.0.1:8996/?hud=0" <work>/runtime-gate.json   # runtime rows (grounding/shadows) for the gate
```
Runtime: /workspace/zb-preview-1008/mesas/mesas.mjs (one material, object-space projection, detail high-pass < 90 m,
sun+hemi, static shadow map refit incl. mesa casters, fog/haze weights tuned to key-city3, ground-material drifts, colliders).
Check scripts: ../mesa-shots.mjs (poses in one load), ../mesa-tune.mjs (uniform sweep), ../console-check.mjs, ../mesa-collide-check.mjs.
SwiftShader runs at ~0.3 fps: wait for frames, not milliseconds.

## v2 pipeline (2026-10-09 evening): blocky strata + depth (`python3 run.py strata ...`)
Stages, in order (each writes its report next to the outputs):
1. `hull.py` - visual hull height field from the accepted Imagine views (front/side/back/top).
2. `fuse.py` - **depth_fuse**: Depth Anything V2-Small (ONNX, onnxruntime CPU, `/workspace/models/depth/dav2-small.onnx`;
   MiDaS v2.1 small fallback) on EVERY accepted view at native resolution; each view's relative disparity is affine-aligned
   to the hull seen from that camera (camera side auto-checked by the correlation sign), fused in a TSDF (0.8 m voxels)
   with silhouette carving -> fused height field `<name>F-H.npy` (bounded to hull +-6 m). Check: cross-view depth
   consistency median < 8 %, p90 < 12 % of the object extent (mesaA: 4.52 % / 10.14 %).
3. `depth_relief.py` - **depth_relief**: DA-V2 on each section plate (native res) -> band-pass (0.25-4 m) relief in metres,
   per-plate p99 normalisation, amplitude per type (mesa +-1.5 m, tower +-0.3 m, rock +-0.6 m), gradient-limited so the
   texture stretch on the displaced surface stays <= 1.3. Used ONLY to displace the shell in/out; the volume is never
   rebuilt from depth (Grok q15). Check: relief std > 8 % of amplitude, spikes < 0.1 %, p99.9 gradient <= limit.
4. `strata.py` (+ `gen_strata_all.py` auto-fix loop) - blocky stratified cliffs on the fused outline: strata from the
   front plate's bedding lines, 3 steep tiers, angular faces <= 10.5 m with fracture steps, caprock overhang/undercut,
   chamfered ledges, fallen blocks + scree; per-vertex plate id + native plate px (walls 80 px/m, caps 64, block faces 320);
   relief displacement on 1 m (LOD0) / 3 m (LOD1) grids faded to 0 at every window border (watertight). QC per LOD:
   min px/m, max stretch, winding, welded non-manifold edges, degenerate tris, repetition (same plate pixels never
   within 30 m; neighbours never share plate pixels). Re-seeds until everything passes.
5. Runtime gate on the STAGING page (mesatest.html -> mesas/mesas-v9.mjs, assembled by `runtime/build.py`, which refuses
   to write the live mesas.mjs) -> live swap + ?v= bump only after PASS. Offline geometry preview: `preview.py`.

## Consistency + key-compare (2026-10-10, mandatory)

| Module | What |
|---|---|
| `palette.py` | `sample` the locked biome palette from the key (→ `palettes/<biome>.json`), `grade` every new Imagine image toward its material at import (Imagine pixels only, ΔE before/after in `palette-log.jsonl`), `shift` (keyloop colour correction), `measure` |
| `consistency.py` | `check`: new reference image vs the key (palette ΔE + style score) → ACCEPT / FLAG / REJECT; `views`: views of one object on their overlap, SSIM ≥ 0.92 and ΔE < 3.5 (q17). Writes Imagine requests, never runs them |
| `fixloop.py keyloop spec.yaml` | key-compare closed loop: shape / colour / detail corrections until the targets are met or progress stalls; `KEYLOOP.md` = first / best / last / target / gap / ceiling per element and metric |
| `auto.py` stages | `consistency` (after `inputs`, blocks on REJECT) and `keycompare` (after `gate`, runs keyloop when below target) |

Spec keys: `palette: {file, materials, keyRect, strength, useGraded}` and `keyCompare: {spec, elements, camera,
maxRounds, stallRounds, colourGain, plates, apply: {colour, shapeSeed, silhouetteWarp, plateRepick, relief, detail}}`
(see `specs/zoneb-mesa.yaml`). Method: `docs/METHOD/key-compare-and-consistency.md`.

## Keyloop consumers, staging mirror, layout correction (2026-10-10 afternoon)

Everything below writes into a **KC staging mirror** only; live files are read, never written (each tool refuses a
live target; `selftest/kc_consumers_st.py` checks the live hashes).

| Module | What |
|---|---|
| `kc_stage.py build / serve / params` | staging mirror of a live game dir made of symlinks (`/workspace/kc-staging/zb`, port 8997): patched copy of `mesas-v11.mjs` that reads `mesas/kc-params.json` (`layout`, `strata`, `plates`, `reliefGain`), `objects1/layout.json` with the biome layout file applied, `kc.html` / `main-kc.mjs` mask page (`?mesaMask=1&mesaOnly=1`). GLB overrides marked `KC-OVERRIDE` survive rebuilds |
| `kc_mesa.py warp` | **silhouette warp** consumer: per key-frame column, vertical stretch (0.7-1.3, base fixed, fallen blocks untouched) of the mesa that owns the skyline there, toward the key's top edge (9-column smoothing rounds the stepped outline); writes `mesas/strata-kc` (raw bins + geo.json) |
| `kc_mesa.py plates` | **colour** (Lab offsets from the loop or linear lit / shadow gains measured key vs render, `--gain-from key-compare.json`), **plate re-pick** (wall slots refilled from the ranked existing Imagine plates, most used slot first, `--exclude w6`), **detail layer** (`--detail G`, high-pass gain of the Imagine pixels). Cumulative state in `plates-kc/kc-state.json`, always rebuilt from the live plates |
| `kc_mesa.py relief` / `detail` | relief strength (LOD0 displacement gain via `kc-params.reliefGain`) / detail value sweep for `fixloop` |
| `kc_glb.py grade` | lit / shadow albedo grade of an image embedded in a GLB (e.g. the spire), staging copy |
| `layout_fit.py fit` | **layout correction**: moves / rotates towers, spire and mesas so the key camera reproduces the key composition (`layouts/<biome>-composition.json`, slots measured on the key) under the city rules (v16 spacing = real streets, avenue clear, 50/50 sides, cameras clear, mesas outside the city). Writes the biome layout file `layouts/<biome>.json` (staging only) + `-fit.png`. Wreck / arch: `status: no-model` |

`specs/zoneb-mesa.yaml` wires every `keyCompare.apply` step to these consumers and sets `stagingUrl` (8997), so
`fixloop.py keyloop` corrections show up in the key-camera render. `shapeSeed` (gen_strata_all) output is reported, not
auto-staged.


## Placement v2 + lighting (2026-10-10, phase 2)
- `placement_v2.py camera` solves yaw, pitch, fov and eye lift on real renders against the composition `camera` targets (avenue vanishing point and spire tip) → `camera-v2.json`.
- `placement_v2.py place` runs a budget-capped greedy loop on real renders: one element at a time, accepted only if its owner element gains IoU and no other element drops, with the street, spacing and 50/50 rules kept.
- Lighting lives in `tools/lighting/light_key.py`.
- `kc_stage.py` now writes staging copies of index.html (kc-light.json loader), objects-t7.mjs (sun, hemi and chromeGraphite exposed) and biome.json (sun and fog overrides).
- See `docs/METHOD/placement-v2.md` and `docs/METHOD/lighting-atmosphere.md`.
- Ember-mesa outputs:
  - `layouts/ember-mesa-camera-v2.json`
  - `layouts/ember-mesa-v2-placed.json`
  - `tools/lighting/ember-mesa-*.json`
