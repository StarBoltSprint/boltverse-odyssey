# Zone C solids clean — FAIL

Verdict: **FAIL**. Two attempts were spent. `numbers.json` has `pass: false`. `kit-gate-result.json` copies the object-gate verdict FAIL. This is not a phone pass. A sealed weld is not a phone pass.

Staging was `http://127.0.0.1:8772/?along=0`. Port 8780 was left alone. Cost: **0 new Imagine**. MoGe-2 was the cached `steps/zone-c/05-solids/data/moge-cache.npz` (0.0 s). Mesh build 11.547 s, atlas 0.192 s, total 12.02 s. Headless capture 67.6 s. Object-gate attempt 2 about 327 s, exit 1.

World graph: `steps/zone-c/05-solids-clean/zone-c.zone.json` (6 objects, `qualityGates.pass` false, `solidsPass` false). `validateZone` ran inside `export-zone-c.mjs` and did not throw.

## Base hull — Zone B mesa method

The volume is **not** a per-pixel MoGe-2 displacement. `tools/imagine-to-3d/zone_c_clean_hull.py` follows the Zone B mesa class (`hull.py` `clean_profile` silhouette, `blender_mesa.py` solidify / voxel-remesh, cell 0.40 m against that file’s 0.35 m class):

- SAM2 mask → one median MoGe depth (placement and size only).
- 0.40 m voxels, thickness 5.6 m along camera forward, side batter 0.70 m.
- 3×3×3 binary close plus a pinch fill, after the columns are draped to `ground − 0.45 m`.
- Outward quads, including ±Z (attempt 1 had ±Z wound inward, so FrontSide culled the camera wall).
- Imagine plates packed like `proj.py`. Key projection is on the key material only (`staging/zone-c-solids/main.mjs`). Putting the key sampler on the plate material made the gate score atlas UVs against the 16:9 key and report stretch 1.333.
- Pack label `model` is `zone-b-mesa-hull`, `hull` is `zone-b-voxel`. `sameHull` is true (one index buffer, tower fix4). Draw calls 11 (max 12).

Attempt 2 also coarsened the terrace: slope 0.20 m/m and a 1.20 m stair every 3.20 m, so a close oblique view could clear 0.5 m. It did not. No third rebuild.

## Relief kept vs dropped

Whole-voxel terraces that stayed on the hull (`work/features.json`):

| Kept | Kind | Protrusion |
| --- | --- | --- |
| arch-left cornice, ledge, talus, frame | cornice / ledge / talus / carved-frame | 1.6, 1.2, 0.8, 0.8 m |
| arch-right cornice, ledge, talus, frame | same | 2.4, 1.2, 0.8, 0.8 m |
| cliff-left cornice, ledge, talus | cornice / ledge / talus | 1.6, 1.2, 0.8 m |
| gorge-rock cornice, ledge, talus | cornice / ledge / talus | 1.6, 1.2, 2.4 m |
| cliff-right cornice, ledge | cornice / ledge | 1.6, 1.2 m |

Dropped (not shipped as extra volume):

| Dropped | Why |
| --- | --- |
| cliff-left vegetation-mass | Sticker block. Hull stays the terrace. |
| gorge-rock vegetation-mass | Same. |
| cliff-right vegetation-mass | Same. |
| cliff-right talus | Band missed the silhouette. |

Triangle-quality **passed** on the terraced hull (aspect p95 1.414, sliver 0). The terraces were kept. They did **not** pass oblique-profile or untextured-area. The addendum says to drop a feature that fails those checks and keep the clean plated hull. Both attempts are already used, so the terraces are what the gate measured. They are recorded as kept geometry and as a blocking FAIL, not as a pass.

## Plate → face

Key-visible faces sample `steps/zone-c/03-terrain/key-zc1.jpg`. Hidden faces use the 11 validated plates (absolute dir `/workspace/grokcli/wt/zc-plates-1012/steps/zone-c/04-plates/`). Plate 13 is one atlas cell with a V band per solid.

| Solid | Back / inner | Side | Bottom |
| --- | --- | --- | --- |
| arch-left | #5 arch-left-inner | #11 leaf | #13 band 0.02–0.18 |
| arch-right | #6 arch-right-inner | #12 fern | #13 band 0.22–0.38 |
| cliff-left | #7 wall-left | #9 waterfall | #13 band 0.42–0.58 |
| gorge-rock | #14 gorge-closure | #10 mist | #13 band 0.62–0.78 |
| cliff-right | #8 wall-right | #15 planet | #13 band 0.82–0.98 |

Hidden-face rows all PASS (tris on the named plate). toneMapped is false on both materials.

## Attempt 2 gate (blocking)

Command: `node tools/object-gate/cli.mjs --scene tools/object-gate/specs/zone-c/solids-scene.yaml --out steps/zone-c/05-solids-clean/object-gate`

| Solid | FAIL rows | UV max | Approach min IoU | Float (gate) | Sealed | Triangle-quality | Oblique (need ≥ 0.5 m) | Untextured (max 0.50%) | px/m |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| arch-left | 4 / 19 | 1.148 | 0.836 | −0.80 m | open 0, non-manifold 0, 6120 tris | PASS aspect p95 1.414 | 8 m 0.798 / 0.400; 30 m 1.809 / 1.548 | 65.42% / 70.77% / 81.08% / 58.95% | FAIL 78.4 |
| arch-right | 5 / 19 | 1.268 | 0.819 | −0.80 m | 2860 tris, sealed | PASS 1.414 | 8 m 0.227 / 0.050; 30 m 0.931 / 0.264 | 40.10% / 50.17% / 95.68% / 30.15% | FAIL 90.6 |
| cliff-left | 3 / 19 | 1.078 | 0.848 | −0.80 m | 14752 tris, sealed | PASS 1.414 | 8 m 0.217 / 0.239; 30 m 1.784 / 1.478 | 0.02% / 13.12% / 9.51% / 7.13% | WARN 58.6 |
| gorge-rock | 3 / 19 | 1.041 | 0.822 | −0.69 m | 24680 tris, sealed | PASS 1.414 | 8 m 0.299 / 0.403; 30 m 1.492 / 1.647 | 1.78% / 31.03% / 0.79% / 32.71% | WARN 62.1 |
| cliff-right | 4 / 19 | 1.116 | 0.757 | −0.80 m | 6756 tris, sealed | PASS 1.414 | 8 m 0.246 / 0.180; 30 m 1.073 / 0.572 | 34.09% / 25.16% / 61.48% / 6.48% | FAIL 55.2 |

Untextured order is 8 m, 30 m, hero, orbit. Oblique pairs are yaw 45 then yaw 75. Packer stretch p95 is 1.1226 / 1.1469 / 1.0561 / 1.0203 / 1.0876 (worst 1.1469, under 1.3).

Also FAIL: arch-right repetition (close peak 0.7249, low-portrait 0.7563, max 0.65). Facade relief PASS on all five, including cliff-right −z 0.4 m, because the row only requires two axes at ≥ 0.5 m. Grounding PASS means “not floating”; the mesh is **sunk** 0.69–0.80 m. The spec asked for 0.00 m. That miss is recorded. The threshold was not edited.

Runtime PASS: no console errors, shaders compile, title “Zone C solids”, 720×1600 and 412×915, cover ≥ 0.997, 11 draws. No `window.__perfReport`.

Colour vs key on the five masks: CIEDE2000 mean **10.122**, median 0.463, 327147 px. Solids2 was mean 16.885, median 13.326, same pixel count.

## Attempt 1 (replaced on disk)

Same hull family, slope 0.62 m/m, no 1.2 m stairs, ±Z inward, key projection on both materials. Gate FAIL 5/5/4/4/4. Shared blockers: UV 1.333 on plate classes (key texture size), approach IoU 0.804 / 0.72 / 0.795 / 0.81 / 0.743, oblique 8 m under 0.5 m, untextured mostly black (arch-left 8 m 78.58%). Triangle-quality already PASS. Copy: `object-gate-attempt1.md`. Attempt 2 fixed the 1.333 stretch and the culled +Z wall. IoU, close oblique, and untextured stayed blocking.

## Why solids2 failed the phone, and what these gates catch

Solids2 displaced noisy MoGe-2 depth onto the shell. The phone saw shredded triangles, flying textures, and grey walls. The old gate passed sealed and hidden-face rows. That is the miss.

This step’s triangle-quality row fails a noisy depth-displaced mesh (self-test aspect 80.012, sliver fraction 1) and passes this voxel hull (aspect 1.414). Untextured-area fails a grey fallback (self-test fraction 0.458) and fails these phone renders. Oblique-profile (same check name as the tower-volumes step, `tools/object-gate/lib/oblique.mjs`) fails a flat quad and fails the close views here. Self-test log: `steps/zone-c/05-solids-clean/selftest.log` (exit 0, including those three blocks).

Thresholds (also in `profiles/rock.yaml` and the scorers):

- Triangle-quality: aspect p95 ≤ 8, sliver aspect 20, sliver fraction ≤ 0.02, facing fragments under 1 px ≤ 0.05 at 30 m / 720×1600 / vfov 51.47, dihedral spike fraction ≤ 0.03 (normals differ by more than 140°), normal p90 ≤ 42°.
- Untextured-area: max bad fraction 0.005 of the object mask. Grey: chroma ≤ 12 and luma in [60, 210]. Black: luma < 14. White: luma > 248 and chroma ≤ 8. Views: 8 m, 30 m, hero, orbit. Captures: `object-gate/untextured-<id>-<view>.png`.
- Oblique-profile: plane-fit residual ≥ max(0.5 m, 0.003 × height) at yaw 45° and 75°, distances 8 m and 30 m, plus min roughness 1.04. Wired on the five `specs/zone-c/*.yaml` files (`minIoU` 0.91 on those files only) and exercised by `solids-scene.yaml`.

## Sheets

- `sheet-phone.jpg` — key beside `renders/phone-720x1600.png` (720×1600, after Chargement).
- `oblique-sheet.jpg` — the five orbit captures from the untextured gate, height 640.

## Merge note

`tools/object-gate` (gate.mjs, selftest.mjs, profiles/rock.yaml, specs/zone-c/*, lib/triangle-quality.mjs, lib/untextured.mjs, lib/oblique.mjs) will conflict with the parallel tower-volumes branch if that branch edits the same files. Oblique-profile reuses that check name and API. Keep both; do not invent a second name.

`steps/zone-c/05-solids/` and `05-solids-v3/` were not the outdir. A stop hook had rewritten solids2 `kit-gate-result.*` and a few object-gate geometry stamps; those paths were restored with `git checkout -- steps/zone-c/05-solids` before this report. Preview on :8780 was not killed.

Quota and the phone-preview freeze wait for an accepted step. This step is not accepted.
