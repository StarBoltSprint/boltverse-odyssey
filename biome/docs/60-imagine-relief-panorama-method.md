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
- Yaw on the 138° plane is **clamped** to −31.27° .. +30.55°. The 2d ring is not clamped; see below.
- Android copy menu, on `html`, `body`, the stage, the canvas, and the buttons:
  - `user-select: none`
  - `-webkit-user-select: none`
  - `-webkit-touch-callout: none`
  - `touch-action: none`

## Texture wider than 4096

WebGL2 `MAX_TEXTURE_SIZE` minimum is **4096**. The 138° panorama is **3916**, so one texture is legal.

The 2d KEEP ring is **4636** wide. Uploading that as one image comes back black on a 4096 GPU. Split at `ceil(width/2)` (**2318 + 2318**) and choose the slice in the fragment shader. The split does not make a seam match. It only makes the upload show the pixels.

## KEEP / FAIL

| Test | Result | Why |
| --- | --- | --- |
| T1 | KEEP | One locked plate, yaw ±20°, depth + high-pass, crisp, no halo, Bolt clean. |
| T2 | FAIL | A second Imagine plate at 40°, crossfaded across 15–25°. Double hull, ghost. Overlap MAE ~50. Do not crossfade two cooks of the same view. |
| 0→40° on plate 0 only | KEEP | Same plate, tripod yaw, no second plate. |
| T2b | FAIL | Asking Imagine to pan (yaw) returned a push-in / dolly. Hull morphed, debris broke. Do not ask Imagine to pan. |
| Plate video as the texture | FAIL | Baked drift, loop snap. Use frame 12. |
| T2c panorama | KEEP | 3916×720, center pixels unchanged, no visible seam, sides match, no stretch at ±31°, Bolt clean, Android menu fixed. |
| T2d 360° cylinder | KEEP | **4636×720** mapped to exactly 360°. Columns `0..31` and the last 32 columns are the same pixels (seam MAE 0). Heading is `((h % τ) + τ) % τ`. No clamp. Camera arm **2.05**: eye `(ARM·sin yaw, 0.02, −ARM + ARM·cos yaw)`, pivot ahead of the camera. Right half is Imagine-only outpaint, each pass a different object, black void between them. The big rock’s depth is clamped to **0.30**, blurred inside the silhouette, then a max-filter skirt of **~4 grid cells** (18 px; cell ≈ 4.58 px) into near-black, feathered down. **Tear is OFF.** |

## Test 2d KEEP — full ring

Owner QC 2026-09-30. The 138° flat plane above stays the 2c KEEP. This is the ring that replaced it.

- Width **4636×720**. `uArc = 2π`, so the full image is one turn. Not 3916.
- Seam: copy columns `0..31` onto the last 32 columns. Those columns match exactly. The wrap is invisible.
- Heading wraps with modulo. **No clamp.** `A`/`D`/drag still 30°/s and one screen = `fovX`.
- Camera arm **2.05** behind the pivot (pivot is ahead of the eye). At heading 0 the eye is still the origin, so plate 0’s framing does not move. Turning translates the eye, so near relief slides over far relief.
- Right of the locked plate (x ≥ 2635) is Imagine image-to-image only. Each pass is a different object. Black void between them is allowed. No pasted copies.
- Big rock (center about heading **69°**): depth clamp **0.30**, gaussian blur inside the silhouette, then dilate that depth **~4 grid cells** into pixels with luminance under 0.03 and feather it down. Stretched triangles then sit on black texels.
- Grid tear **OFF**. Discarding triangles with a depth jump removed interior triangles and shredded the rock. Do not turn it back on.

### 2d attempts that FAILED before this KEEP

| Attempt | Why it failed |
| --- | --- |
| Wrap pop | 0/360 snapped (readout about 18° → 340°). The width was not one matched seam mapped to exactly 360°. |
| Pasted copies | The same asteroid and wreck repeated, and near 72° a stack of identical square rocks. |
| Flat center yaw | Camera at the cylinder center, pure yaw, no translation. Near and far scrolled together. |
| Smear | Depth-jump triangles stretched the rock into rubber fins and horizontal streaks. |
| Shredded rock | The depth-jump tear punched black holes inside the rock, not only at the silhouette. |
| Half rock | The Imagine pass was cut by its own frame edge (a straight vertical cut, left half black). Redo that gap as one new outpaint. Do not leave the cut. |

## Test 3 — FAR→MID rock handoff (PARKED)

Status **PARKED — "better, not perfect"**. Sandbox only. Not KEEP.

- The FAR→MID handoff was a **one-frame cut**. It is now a **smoothstep** crossfade over zoom **1.18× → 1.30×**.
- Registration: within **~2 px** on the edges. About **12 px** off on the top contour, because the MID / NEAR stills are **different sculpts**.
- Zoom cap **1.30×**. Never zoom a plate past it (law 59 approach).

## Law 59 extension — closed invisible hull (walk-around objects)

**Owner-approved 2026-09-30.** Extends [`59-invisible-depth-carrier.md`](59-invisible-depth-carrier.md). Everything else in law 59 stays.

- For **walk-around objects**, the invisible depth carrier may be a **CLOSED invisible hull**.
- The hull is computed in code: **silhouette carving** of the object's Imagine views, then **Depth Anything V2** refinement.
- The Imagine views are projected onto the hull. The hull **never draws its own pixels**: no own color, texture, lighting, or shading. Every visible pixel is an Imagine pixel.
- **Not for Bolt.** Bolt stays `lock/bolt-gallop-cycle.mp4`, keyed, screen-centered.
- **Not a license** for procedural or mesh worlds, terrain generators, or modeled objects.

## KEEP method — walk-around object from Imagine stills

Validated for **rock construction**. Movement is still in progress (see the test 4 FAIL table, last row).

1. **V0.** Start from one sharp Imagine still of the object. Full-res PNG, **1248×1584**, lossless.
2. **8 views.** Cook one view every **45°**, progressively, with Imagine **IMAGE**. Each view is cooked from its neighbor + V0 as reference, with a **silhouette lock**: area **±15%**, height **±8%** vs its neighbors. No video.
3. **QC.** Check every view against V0: same object, same features, no extra lobes. Reject and recook any view that differs.
4. **Hull.** Voxel visual hull: keep a voxel when **7 of 8** silhouettes agree. Refine with Depth Anything V2, smooth, and close the underside with a **rounded cap**. No flat cut, no floor.
5. **Texturing.**
   - Each of the 8 photos is projected from its **FIXED world camera**.
   - Per surface point, use **ONE** best-facing view. Weight `(normal · viewDir)^8`.
   - Blend only in a **narrow seam band**.
   - Fall back to the **nearest view**. Never black, never averaged.
   - Native-res textures, mipmaps + max anisotropy. Close-up cap **1.30×**.
   - Texture choice must **never** depend on the current camera yaw.
6. **Placement.** Put the object at a **fixed world position** with a **collision radius**. The 360° ring holds **FAR content only** (stars, nebula, distant asteroids). Near objects are keyed out of the ring and live in the world.

Later: script the pipeline — image → 8 views → QC → hull → placement. Budget **2–3** walk-around objects per clearing.

## Test 4 attempts that FAILED (2026-09-30)

| Attempt | Why it failed |
| --- | --- |
| Turntable video | One Imagine Video of the object spinning 360°. The object morphs, and the ring rotated like a carousel. |
| Video wedges | Imagine Video rotation wedges between key views (fixed first / last frame). Still morphs. |
| Card scroll | A single card with the 8 views scrolling past Bolt as the rotation center. No volume, no real movement. |
| See-through crossfade | Crossfading between views. Ghosting. |
| No silhouette lock | Views cooked without the silhouette lock. Lobes on the sides and back. |
| Averaged views | All views averaged, facing angle up to 60° on one face. Marbled, streaky smear, although the source PNGs were sharp. |
| 24 extra views | In-betweens + top + low, added without strict same-object QC. The hull was carved with holes, blocky staircase. |
| Unkeyed props | Extra small props as unkeyed stills. "Photos in black frames". |
| Blanked ring | Clearing the ghost near-rock by blanking the ring. The ring went black. Fix: key out only the near-rock patch and fill it from its neighbors. |
| Letterbox | Landscape canvas letterboxed on a portrait phone. Black bands. Fix: `100dvh` / `100vw` canvas, ring extended only beyond its top / bottom edges, buttons as a transparent overlay. |
| Camera-locked object | Camera locked rigidly behind Bolt, and the object attached to the camera. Bolt never moves on screen, and the object seems to rotate with the ring. HUD position / distance constant = **FAIL signal**. Movement must be proven with HUD **x, z, heading and distance** changing. |

## Next — not KEEP yet

1. Approach test (sandbox only). Never zoom a plate past **~1.3×**. Crossfade to a closer plate of the same object on the same axis (far / mid / near). Law 59.
2. The turntable / rotation-video rock is **FAIL** (see the test 4 FAIL table). Next: the walk-around rock via the closed invisible hull method above, from **8 Imagine still views**, plus real free movement of Bolt around a fixed rock.
3. First space zone only after approach passes QC.
4. Ground biome later. Do not start it from this PR.

## Do not

- Merge this PR without review.
- Hang the sandbox preview, or touch the live play URL.
- Put Bolt on the depth carrier.
- Crossfade two different cooks of one heading.
- Ask Imagine to pan.
- Paste or clone pixels to fill a gap.
