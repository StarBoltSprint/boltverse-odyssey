# Root cause notes, terrace sky build 3e8dce00 (Tools Engineer, 2026-10-13)

## 1. Why the oblique-profile check passed facades with no depth
- **Offline only.** `tools/gate/volume.py` reads `renders/oblique45-pass.npz` and `grazing-pass.npz`. These are 320x180 offline Blender passes, never the served page. If a view file is missing, it is skipped silently (`continue`), and a single view is enough to pass.
- **Whole object, not per face.** It computes `stepFrac >= 0.03` and `normSpread >= 0.15` over every object pixel. The metre-high tier steps and the cornice slabs alone meet both thresholds. On v3.5 it gave oblique45 stepFrac 0.0765, normSpread 0.588, and grazing 0.214 / 0.311, so it PASSED.
- **Absolute mode with a 0.40-0.42 m step threshold.** The CLI never passes `relief_depth_m`, so the 0.5 x declared-depth relief mode never ran. The threshold was `max(0.25, 3% of range)`, which comes to 0.42 m. Any relief shallower than that was invisible to the check by construction.
- **Real mesh depth under the relief pixels**, measured on the same npz with tier jumps excluded:
  - close3m facade: second-difference residual p99 is **1 mm**;
  - close8m facade: p99 is 1.2 cm;
  - pixels with at least 3 cm of relief: 0.0 %.
- **Why the geometry is that flat:** `terrace_block.py` displaces the front by `AMP 0.06 x relief/0.6`, so 6 cm at most, while MoGe-2 reads up to 0.6 m in the same pixels. The sides get ±0.26 m (`AMP_SIDE`). The middle front panel has its relief locked off entirely.

## 2. Why the textures were lost in 3e8dce00 compared with dd80963f
- **No material lost its map.** In the live scene, all 7 materials on LOD0, LOD1 and LOD2 have a 1024² map, with anisotropy 16 and trilinear filtering.
- **The UVs are wrong.** `build-play-sky.sh` runs `strip-glb-images.py` first and then `gltfpack -vt 14`. gltfpack quantizes UVs to 14 bits and stores the dequantize offset/scale in `KHR_texture_transform` on the material's texture. The images were already stripped, so there is no texture to carry that transform, and it is dropped.
- **What the page does with them:** it reads the uint16-normalized values (0..16383/65535). Live UV range on every material and every LOD is **[0, 0.25]**; the originals were 0.16–0.88 (top 0.11–1.54).
- **What that looks like:** every face samples the top-left 256x256 px corner of its plate at 4x magnification. That gives:
  - **dark blue untextured walls**: the plate corner is background, mean RGB (40, 55, 70);
  - **the blocky door stone**, from the 4x magnification;
  - wrong pixels everywhere.
- **The ground** is a separate problem: plain color, no map at all (the fix-door-ghost change).
- **Not the cause:** parseAsync merge conflicts, KTX2 on the terrace, or a missing map.
- **Fix, for after the freeze:** either keep the textures through gltfpack and copy their transform onto the page's rebuilt materials, or use `-noq` / `-vt 16` with a texture transform; then fail on any UV max ≤ 0.25. The new playgate texel probe logs `uvStep` and the UV range.

## 3. The magenta patch in the sky (not reproduced on the box)
- **No transcoder path.** The sky is raw ASTC 4x4 sRGB KTX2 (vkFormat 158, supercompression 0, 2 levels, 1280x720), uploaded as-is into a CompressedArrayTexture. There is no Basis/transcoder fallback in the path, so a "transcoder fallback" is ruled out. All 12 headers are identical and valid.
- **Not reproduced on the box.** SwiftShader exposes `WEBGL_compressed_texture_astc`, and the box renders show no magenta: screen magenta is 0 in the gate.
- **The phone is still a suspect.** The S20 FE (Adreno 650 or Mali-G77) supports ASTC LDR, so the format itself should be fine. That points to a per-section block-data or driver decode issue on one section. The section can't be named until we have a phone screenshot with the heading (azimuth / 30° = section index).
- **Mitigation, after the freeze:** a JPG fallback per section (the 0736x star-preserving JPG already exists for S00), plus the playgate material and screen-magenta check.

## Note for later (after the freeze)
The sky band gate passes S04, S09 and S11 final2, which are must-fail cases.
