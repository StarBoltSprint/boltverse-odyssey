# Imagine-to-3D AUTO — one command, end to end (2026-10-10)

SmiR 2026-10-10: everything learned 10-08..10-10 goes into the tool, so every new object or biome comes out at
native 1080p quality (S20 FE, 1080 × 2400, full pixel ratio 2.625) with no manual step. Code:
[`tools/imagine-to-3d/auto.py`](../../tools/imagine-to-3d/auto.py). It reuses the existing stages; it does not rewrite them.

## Run it

```bash
cd tools/imagine-to-3d
python3 auto.py plan specs/zoneb-mesa.yaml                 # stage list + what is still manual
python3 auto.py run  specs/zoneb-mesa.yaml                 # all stages; add --no-browser on a busy box
python3 auto.py run  specs/zoneb-mesa.yaml --from perf     # resume from one stage
cat /workspace/i23d-auto/zoneb-mesa/REPORT.md              # every row, verdict, Imagine requests, manual items
```

A spec is one YAML file: `object`, `type` (or `auto` → classify.py), `crop`, `heightM`, `work`, `staging`,
`stagingUrl` (staging page that mounts the staging dir), `imagine:` (existing views, plates.json, detail crops,
section cells), `geometry:`, `detail:`, `grade:`, `morph:`, `gate:`. Examples: `specs/zoneb-mesa.yaml`,
`specs/zoneb-mesa-build.yaml`, `specs/zoneb-tower-sections.yaml`.

Exit 0 only when no stage is FAIL / ERROR / NEEDS_IMAGINE / NEEDS_REVIEW / MANUAL. The staging → live swap stays a
human decision after that.

## Stages and the lesson each one enforces

| Stage | Reuses | Hard check (lesson) |
|---|---|---|
| inputs | `i23d_common.IMAGINE_NATIVE` | Every pixel is Imagine. Every file is at a native Imagine size, or a recorded crop of one (never upscaled). Near-duplicate edits (corr > 0.9) count as ONE image. Too few distinct wall images for the no-repetition rule → **NEEDS_IMAGINE**: a request batch for `imagine.py` is written and never run. |
| classify | `classify.py` | type → profile; unsure → Grok vision (NEEDS_REVIEW) |
| shape | `hull.py`, `fuse.py`, `depth_relief.py` | DA-V2 fused depth, cross-view consistency median < 8 %, p90 < 12 %. **Buildings** (`profiles/building.yaml` `relief.mode: hard-surface`, or `geometry.generator: hard-surface`) skip the hull and run `depth_relief.py building`: the same per-plate DA-V2, then quantise into a few flat planes. A building spec with no `geometry` block still skips. |
| geometry | `strata2.py` via `gen_strata_all.py` (`GEN=strata2.py`); buildings: `hard_surface.py` | **Continuous strata/surfaces, never independent boxes:** one wall per section, plate windows from joint to joint with blended joints, smooth position-welded normals in the runtime, and a random crop rotation and tone per fallen block. **Shape-seed search** until the outline IoU vs the key crop is ≥ 0.87, then window salts until there is no repetition (no group clash within 30 m, neighbours < 7 m share nothing). Also: same shell at every LOD with relief stored as an attribute, ≥ 64 px/m, stretch ≤ 1.3, 0 non-manifold edges. **Buildings** score `hard-surface-v1` instead: same shell, px/m ≥ 85, stretch ≤ 1.25, 0 open / non-manifold, relief depth ≥ 0.30 m on at least two facade directions (per-metre median span), silhouette not a flat top and not a solid slab (enclosed hole pixels). |
| pack | `pack_strata.py`; buildings copy `<mod>/<mod>.glb` | int16 + index + gzip, LOD2 dropped, LOD0 fetched on demand, `gen-summary.json` copied with it. Buildings pack the GLB next to `*-geo.json` (no `.bin.gz`). |
| detail | `detail/bake_detail.py`, `detail/repeat_check.py` | **Hybrid texturing layer 2:** a tiling Imagine detail layer at 512 px/m, baked from EXISTING seamless Imagine crops (928 px / 1.8125 m), with a DA-V2 normal. Repetition is checked in texture space: hex lattice peak ≤ background. Writes `detail.json`. Runtime: `runtime/detail-chunk.js` (objects; 3-tap hex, full under 15 m, fades out over 15–30 m, surface only) and `detail/make_runtime_gd.py` (ground). Layer 1 stays the unique native plates. |
| grade | `grade/decode.py` → `grade/grade.mjs` (the runtime's OWN grading functions) → `grade/atlas.py` | Grading moves offline into R8 brightness atlases at native 1024 px per cell plus a low-res chroma atlas. ΔE mean ≤ 1, p99 ≤ 6. Zone B towers: 213 → 60 MiB. |
| stage | — | Copies into the STAGING dir only. It refuses the live root and any folder without its marker (never edit the live preview in place). Buildings also copy each module GLB to `<staging>/<mod>/<mod>.glb`. |
| shaders | `checks/dump-shaders.mjs` | the page's fragment shaders → `.frag` |
| perf | `checks/perf_budget.py` (+ `detail/shcount.sh`) | **Budget at the full pixel ratio.** These rows can FAIL: start download ≤ 8 MB, LOD0 ≤ 12 MB per object, texture GPU ≤ 64 MiB, fragment ≤ 900 static SPIR-V instructions / 16 fetch sites / 2 loops, draw calls per type ≤ 2 (merged or instanced). Resident triangles are INFO only, because geometry is never reduced for the phone. A FAIL is fixed by a cheaper path, never by fewer pixels. |
| morph | `checks/approach-morph.mjs` + `checks/morph_iou.py` (towers: `checks/lod-morph-gate.mjs`) | Approach 300 → 10 → 300 m with the camera **outside the collision hull** (a frame inside → FAIL). Any jump in silhouette IoU → FAIL. Same-shell LODs plus a relief grow-in over 3 s when LOD0 arrives late. |
| gate | `tools/object-gate/cli.mjs` (PR #191) + `fixloop.py plan` | Zero FAIL on every #191 row: visible px/m measured on the render, no repetition, morph, grounding, console/shader, shadows, checklist. A FAIL → fix actions. |
| report | — | `REPORT.md` |

**Lesson — building facades = mesa depth relief, quantised to hard planes.** The facade uses the same Depth Anything V2
read as the mesas (`depth_relief.py`: native plate, band-pass, per-plate p99). `mode: hard-surface` on the building
profile then snaps that depth onto a few shared planes (field, two or three bay depths) with vertical steps on the
plate's dominant lines. Ribs and slabs stay the outer plane; bays step into the volume. A one-plane map and a noisy
map both FAIL `check_hard`. The geometry stage also FAILs when fewer than two directions have a per-metre
offset span ≥ 0.30 m (the object-gate facade-relief median: each triangle is scored in the metre of its
centroid, so ribs and bays are cut on integer metres). The object-gate `facade crispness` row FAILs a flat
slab (one offset plane) and a blobby facade (too many planes, or normals that are not axis-aligned). Mesas
stay on `relief()` and do not emit that row.

## Still manual (printed in every report)

- **New Imagine images.** The tool only writes the request batch. Running it needs approval.
- **First mount of a NEW object type** into the game page (one import + one call). After that, the staging page
  reloads the staged assets by itself.
- **Staging → live swap** and the `?v` bump: SmiR's call after the report.
- **Real-phone fps** on the S20 FE: the box has no GPU, so SwiftShader timings are relative only.
- **Checklist pass records** (Grok vision or owner).

## FPS optimisations

The ground executor's PERF pass (PROGRESS-ground-detail.md P0–P4: RGBA8 sRGB scene target, no MSAA canvas,
dynamic internal resolution 1.25..cap, POM steps scaled with the fade, skipped hex taps under 2 % weight) is vendored as
`detail/make_runtime_opt.py`. It is folded into the per-object budget once that pass is final. Until then the perf
stage scores each object's own cost.
