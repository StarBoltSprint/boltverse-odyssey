# 60 — Imagine relief panorama method

Review only. Not a hang. Not a new play URL. The carrier law is [`59-invisible-depth-carrier.md`](59-invisible-depth-carrier.md). Redo this from `assets/relief/` and `tools/relief/`. Do not recook plate 0 from a guessed prompt.

## Plate 0 — locked still, no baked drift

- First cook was an Imagine **video**, locked-off (no pan, no dolly, no zoom). The shot on disk is 1280×720, 24 fps, 6.04 s, h264.
- That video is **FAIL** as the relief texture. Objects drift, and the loop snaps. Do not play it on the carrier.
- The KEEP texture is one frame of that video: **frame index 12** (0-based). `assets/relief/plate0.png` is byte-identical to that frame (MAE 0). 1280×720 RGB.
- The Imagine prompt string was not stored with the asset. Do not invent one. Reuse the PNG.

## Depth

Model: **Depth Anything V2 Small**, ONNX, input `pixel_values`. ImageNet mean `(0.485, 0.456, 0.406)`, std `(0.229, 0.224, 0.225)`. Near = white = 1. Inference is run at height **700**, then resized back to 720.

Plate, one 1280-wide tile (`tools/relief/bake_depth.py`):

1. Min-max the raw depth to 0..1.
2. `coarse = gaussian(raw, σ=1.1)`, then stretch percentiles **2..99** to 0..1.
3. `lum = 0.2126 R + 0.7152 G + 0.0722 B`.
4. `detail = lum − gaussian(lum, σ=2.0)`.
5. `mask = smoothstep(0.15, 0.18, coarse)`.
6. `masked = detail * mask`. Scale so `p90(|masked|)` where `mask > 0.5` equals **0.035**.
7. `out = gaussian(coarse + clip(masked * scale, −0.2, 0.2), σ=0.9)`, clipped 0..1.
8. Luminance gate, so black does not become a depth vignette: `out *= smoothstep(0.012, 0.045, gaussian(lum, σ=1.2))`.

The shipped plate map is the test-1 map, not a fresh inference: `assets/relief/depth-plate.png`. The script locks those pixels.

Panorama 3916×720 is tiled. A single ONNX pass of that width was killed (OOM).

- Tile width **1280**, overlap **320**, cosine blend in the overlap.
- Starts for 3916: **0, 960, 1920, 2636**.
- Same high-pass as the plate.
- **Soft sides only**, outside the plate window: `gaussian(out, σ=6) * 0.42`. Oblique yaw on full-strength side detail streaked.
- **Lock:** columns `x = 1355 .. 2634` are copied from `depth-plate.png` and not changed. A **96 px** feather is only outside that window, from the locked edge out into the soft side.

Output: `assets/relief/depth-panorama-138.png`.

## Relief carrier

Invisible. No own color, no own texture, no lighting. Raw **WebGL2**. No Three.js. Law 59.

| | |
| --- | --- |
| Grid | **280** columns across 1280 px, **158** rows. Panorama columns = `round(280 * 3916 / 1280)` = **857**. Rows stay 158. |
| Displacement | `AMP = 0.9`, bias `0`, stretch discard **off** (`STRETCH = 0`). Offset = depth × 0.9. |
| Camera (2c KEEP) | Tripod yaw only. Eye `(0, 0.02, 6.2)`. Look `(sin yaw, 0.02, 6.2 − cos yaw)`. No dolly. |
| FOV | **46°** vertical. `COVER = 1.14`. View **1123×632** (`round(1280/1.14)`, `round(720/1.14)`). |
| Horizontal FOV | `fovX = 2 * atan(tan(fov/2) * (1123/632))` ≈ **74.05°**. |
| Clip | near `0.08`, far `40`. |
| Yaw clamp (2c) | **−31.27° to +30.55°**. Past that the flat plane grazes and stretches. |
| Depth test | On for the plate. Off for Bolt. |

## Outpaint — test 2c, ~138°, center locked

Imagine **image-to-image** still extension. Not a video, and not a camera pan.

- Seed: the 1280 plate centered in a **2120×720** canvas, black bars on the sides.
- Recorded intermediate width **2277**, then a **3177** seed.
- Final KEEP: `assets/relief/panorama-138.png`, **3916×720**.
- Plate window: **x = 1355**, width **1280**. Those pixels equal `plate0.png` (MAE 0). Hard-paste them after every pass. Do not blend the center.
- Left of the plate: **1355** px. Right: `3916 − 2635` = **1281** px.
- Each pass: search scale and offset to minimize overlap MAE, then hard-paste every pixel that was already kept. Accepted seam overlaps were about **MAE 0.02–3.5**. Plate MAE stays **0**.
- Same black void, same light. New rocks only in the new side pixels.
- Flat-plane coverage: the 74.05° frustum inside the −31.27° / +30.55° clamp is about **136°**, QC'd as **~138°**. This is not a 360° loop.

## Bolt

- Already in the repo: `lock/bolt-gallop-cycle.mp4`. Rear view. The sandbox copy measured **768×1168**, **96 fps**, **5.56 s**. Do not invent a gallop.
- Keyed on top, screen-centered quad. Never sampled as depth. Never extruded. Never on the carrier.
- Sandbox relief key (not the lane compositor in law 17):
  - `greenness = G − max(R, B)`
  - discard if `greenness > 0.45`
  - alpha = `1 − smoothstep(0.12, 0.40, greenness)`
  - despill: `G = mix(G, min(G, max(R,B)), smoothstep(0.0, 0.22, greenness))`
- On-screen height `min(632 * 0.7, 1168)`. Width keeps `768/1168`.
- Depth test **off** while Bolt draws.

## Controls (2c KEEP)

- `A` / `ArrowLeft`: steer −1. `D` / `ArrowRight`: steer +1.
- Held keys: **30°/s**.
- Drag: `Δheading = (Δx / canvasWidth) * fovX`. One screen width is the horizontal FOV. Uses the canvas rect, not a constant.
- On-screen Left / Right buttons are the same hold.
- Yaw is **clamped** to −31.27° .. +30.55°. Taking the clamp off was part of the 2d FAIL.
- Android copy menu, on `html`, `body`, the stage, the canvas, and the buttons:
  - `user-select: none`
  - `-webkit-user-select: none`
  - `-webkit-touch-callout: none`
  - `touch-action: none`

## Texture wider than 4096

WebGL2 `MAX_TEXTURE_SIZE` minimum is **4096**. The 138° panorama is **3916**, so one texture is legal.

A 360° attempt was **4636** wide. Uploading that as one image comes back black on a 4096 GPU. Split at `ceil(width/2)` (**2318 + 2318**) and choose the slice in the fragment shader. The split does not make a seam match. It only makes the upload show the pixels.

## KEEP / FAIL

| Test | Result | Why |
| --- | --- | --- |
| T1 | KEEP | One locked plate, yaw ±20°, depth + high-pass, crisp, no halo, Bolt clean. |
| T2 | FAIL | A second Imagine plate at 40°, crossfaded across 15–25°. Double hull, ghost. Overlap MAE ~50. Do not crossfade two cooks of the same view. |
| 0→40° on plate 0 only | KEEP | Same plate, tripod yaw, no second plate. |
| T2b | FAIL | Asking Imagine to pan (yaw) returned a push-in / dolly. Hull morphed, debris broke. Do not ask Imagine to pan. |
| Plate video as the texture | FAIL | Baked drift, loop snap. Use frame 12. |
| T2c panorama | KEEP | 3916×720, center pixels unchanged, no visible seam, sides match, no stretch at ±31°, Bolt clean, Android menu fixed. |
| T2d 360° cylinder | FAIL | (1) 0/360 wrap pops: readout jumped about 18° → 340°, the center wreck vanished, the view snapped to the start. The width was not one matched seam mapped to exactly 360°. (2) Pasted copies: the same asteroid and wreck repeated, and near 72° a stack of identical square rocks. Pasted pixels are FAIL. Imagine-only. (3) Flat: the camera sat at the cylinder center, pure yaw, no translation, so near and far scrolled together. No parallax. |

## Next — not done, not KEEP

1. **2d fix** (sandbox only, still not a hang):
   - column 0 and the last column are the same seam; the full image width maps to exactly 360°; heading wraps with modulo; no clamp
   - delete every pasted duplicate; refill the right half only with Imagine outpaint passes, each pass different; black void between them is allowed
   - camera on a short arm behind Bolt, pivot ahead of the camera (the test-1 orbit), so turning also translates; relief stays on the whole ring; near rocks must slide over far detail
2. Approach test. Never zoom a plate past **~1.3×**. Crossfade to a closer plate on the same axis (far / mid / near). Law 59.
3. One rock as a 360° Imagine turntable. Not a pasted copy.
4. First space zone only after 2d passes QC.
5. Ground biome later. Do not start it from this PR.

## Do not

- Merge this PR without review.
- Hang the sandbox preview, or touch the live play URL.
- Put Bolt on the depth carrier.
- Crossfade two different cooks of one heading.
- Ask Imagine to pan.
- Paste or clone pixels to fill a gap.
