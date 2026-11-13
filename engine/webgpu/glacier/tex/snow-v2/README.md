# Glacier snow-crust stills v2

Four new Imagine snow-crust stills for PR 238 (branch `cursor/glacier-abyss-dawn-b27b`), to replace glacier snow stills 0/1/2 which carry large plates and wind slabs that column when they repeat every 0.5 m.

Reference: existing **still 3** = `engine/webgpu/glacier/tex/snow/v4.jpg` in the PR 238 checkout (0-indexed: v1=still 0 … v4=still 3). Fine and even; mean Lab **L=72.575 a=-1.233 b=-7.519**, mean sRGB **169, 179, 192**.

The PR branch was not modified. Nothing was committed, pushed, or deleted.

## Official column gate (not run on these files)

`engine/webgpu/glacier/test-still-columns.mjs` (PR tip `7b48b4a`, blocking at **1.5**) is a Chrome chase test, not a still-file analyser. It serves `glacier.html`, calls `window.__glacierStills(t)` at 5.1 / 5.567 / 7.9 / 11.7 s, and refuses a still whose rendered peak is above 1.5. Still 3 is the bar, about 1.3 on that chase.

It could not be run here:

- The local checkout at `/workspace/glacier-test/tip` is detached at an older commit and does not contain the script (it is on the later PR tip).
- The test needs Chrome (`chrome.mjs`) and the stills wired into the live glacier page.
- This brief forbids touching PR branch files, so the new stills were not installed into the engine.

Node v24.22.1 is installed, but that is not enough to run the chase gate.

## Offline stand-in

Copied `precheck_atlas.py` from the PR (perspective ground projection + the same `grid_peak` family as `grid-measure.mjs`) into `tools/precheck_atlas.py`. Used only on copies under this review folder.

This offline peak does **not** reproduce the chase ranking or the 1.5 chase threshold. Calibration on the existing 1024 px snow stills (78 views each):

| Existing still | file | worst peak | views over 1.5 | Chase (PR body, for context) |
| --- | --- | --- | --- | --- |
| 0 | v1.jpg | 2.732 | 11/78 | fails (2.44–3.45) |
| 1 | v2.jpg | 1.643 | 1/78 | fails (1.69–4.03) |
| 2 | v3.jpg | 3.251 | 14/78 | fails (2.42–4.26) |
| 3 | v4.jpg | 3.175 | 2/78 | passes (~1.24–1.41) |

So a raw-still synth peak below 1.5 is not expected even for still 3. Scores below are reported against still 3’s offline worst (**3.175**) as a comparative bar, plus a visual 4×4 read, plus mean-Lab CIE76 ≤ 10.

Also recorded: inner row/col luma swing (border 64 px omitted) and wrap-edge step vs interior gradient.

## Delivered stills

All four are native Imagine **1024×1024** (square, not upscaled, stretched, or crop-resized). Imagine returned JPEG; deliverables are lossless PNG of those pixels, with an optional in-house wrap that does not resample (circular offset by 512 px plus a 64 px feathered cross-blend of the still’s own pixels), used only when the 4×4 did not get worse.

Contact sheet of the four 4×4 previews (each preview is a BOX downsample of the tiled native 4096 px image):

`/workspace/glacier-review/snow-stills-v2/snow-v2-contact-tile4x4.jpg`

| id | file | CIE76 vs still 3 | offline column worst (overs) | wrap | 4×4 eye | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| snow-v2-0 | [snow-v2-0.png](snow-v2-0.png) | 8.925 | 2.825 (14/78) | offset+64 px mid blend | even, no grid, no columns, no patches; fine isotropic grain | **PASS** |
| snow-v2-1 | [snow-v2-1.png](snow-v2-1.png) | 7.730 | 1.886 (4/78) | offset+64 px mid blend | even, no grid, no columns, no patches; fine isotropic grain | **PASS** |
| snow-v2-2 | [snow-v2-2.png](snow-v2-2.png) | 3.423 | 2.521 (7/78) | raw | even, no grid or plates; mild diagonal grain | **PASS** (soft: not fully isotropic) |
| snow-v2-3 | [snow-v2-3.png](snow-v2-3.png) | 6.315 | 2.311 (1/78) | raw | even, no grid or plates; clearer fine diagonal grain | **PASS** (soft: grain direction) |

All four are at or under still 3’s offline worst peak (3.175). snow-v2-1 is the strongest on that metric. snow-v2-2 is the closest in colour.

4×4 previews: `snow-v2-0-tile4x4.jpg` … `snow-v2-3-tile4x4.jpg`.

---

### snow-v2-0

- **Prompt:** Photorealistic square seamless material photograph of a perfectly even field of packed dry glacier firn, shot with a camera aimed straight down, orthographic top view, filling the entire frame with no border. Lit by a huge on-axis softbox so the illumination is dead flat and even, no shadows, no highlight sweep, no top-to-bottom gradient. Real glacier snow colour: muted cool blue-grey, sRGB near 169 179 192, not paper white. Only very fine isotropic crust grain, like sugar or salt sprinkled evenly, no direction, no ripples, no wind texture, no sastrugi, no plates, no dunes, no footprints, no cracks, no ice glaze, no rocks. No large bright or dark patches. Matte, not glossy, not chrome. Tileable without a visible repeat when placed in a grid. Half a metre across.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG after wrap)
- **sha256:** `ed824fe7bf7f608a032203b5fb3d63a3bb6e4dbeaf830f5c8ab3157ca576f8e3`
- **Column score (offline precheck worst / 78 views):** 2.825 at heading 0°, offset (0.25, 0); 14 views over 1.5. Better than still 3’s worst (3.175), more views over 1.5 than still 3 (2/78).
- **CIE76 mean Lab vs still 3:** 8.925 (pass ≤10). Mean Lab L=80.031 a=-1.341 b=-2.616. A little paler and less blue than still 3; within the number.
- **Low-freq:** inner rowSwing 5.99, colSwing 3.97 (still 3: 7.08 / 2.60).
- **Eye, 4×4:** Clean. Fine even grain, no visible tile joint, no columns, no large patches. Soft: slightly pale vs the reference.
- **Verdict:** PASS

### snow-v2-1

- **Prompt:** Photorealistic square seamless material photo of a perfectly even packed dry glacier firn crust, camera aimed straight down, orthographic top view, full bleed edge to edge, no border, no sky, no text. Lit by a huge on-axis softbox so illumination is dead flat: the top of the frame, the bottom, the centre, and all four corners have the same brightness, no vignette, no edge darkening, no highlight sweep, no soft banding. Colour is muted cool blue-grey packed glacier snow, about sRGB 169 179 192, duskier than fresh powder, not paper white, not silver. Only very fine isotropic crust grain like sugar sprinkled evenly, no combing, no brushing, no preferred direction, no ripples, no wind texture, no sastrugi, no plates, no dunes, no footprints, no cracks, no ice glaze, no rocks. No large bright or dark patches. Matte, not glossy, not chrome. The texture must tile in a 4 by 4 grid with no visible seam or repeating band. Half a metre across the frame.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG after wrap)
- **sha256:** `6d2e57cfddc8a7672e37a85ee1957ed5456f448c5281096553c6961c4bd06a52`
- **Column score:** 1.886 at heading 105°, offset (1.0, 0.5); 4/78 over 1.5. Best of the four; under still 3’s offline worst.
- **CIE76 mean Lab vs still 3:** 7.730 (pass). Mean Lab L=78.195 a=-1.305 b=-2.213.
- **Low-freq:** inner rowSwing 5.17, colSwing 3.63.
- **Eye, 4×4:** Clean, same family as v2-0, no grid or columns.
- **Verdict:** PASS

### snow-v2-2

- **Prompt:** A square tileable photograph of uniform packed glacier snow crust from directly above, orthographic, edge to edge, no frame. Huge soft even light with identical brightness at every part of the frame. Fine even field of isotropic firn granules, like a quiet snow table with no wind writing and no combed grain. Colour is real packed glacier snow, cool grey-blue, sRGB 169 179 192, not chalk white, not too pale. No sastrugi, no ripples, no diagonal drift, no plates, no slabs, no dunes, no footprints, no cracks, no puddles, no stones, no gloss, no chrome, no vignette, no darker edges. Seamless when repeated four times. About half a metre of ground.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap — an offset wrap introduced a visible mid-tile grid)
- **sha256:** `2afdbf7e03fb04eafcd1daca34b8ce8a8f4a50053793ccbdf3bdc1e118e2cc8f`
- **Column score:** 2.521 at heading 105°, offset (0.13, 0.37); 7/78 over 1.5. Under still 3’s offline worst.
- **CIE76 mean Lab vs still 3:** 3.423 (pass, closest of the four). Mean Lab L=71.751 a=-1.517 b=-4.209. Mean sRGB 169, 177, 183.
- **Low-freq:** inner rowSwing 6.75, colSwing 4.81. Raw wrap-edge ratio ~1.5 (similar to still 3’s seam, not a visual 4×4 grid).
- **Eye, 4×4:** Even, no plates or columns. Mild diagonal grain, finer than stills 0/1/2, not fully isotropic.
- **Verdict:** PASS, with a soft on grain direction

### snow-v2-3

- **Prompt:** Photorealistic top-down orthographic close-up of packed glacier snow crust, full-bleed square photograph filling the frame edge to edge, no border, no letterbox, no sky, no horizon, no text, no watermark. Camera looks straight down. Perfectly uniform flat overcast light with no gradient whatsoever: the top of the frame is the same brightness as the bottom, and all four corners match; no vignette, no falloff, no brighter band, no darker band, no sloping shade, no soft spotlight. Colour is pale cool blue-grey packed glacier snow, slightly dusky, not bright white, not warm, about sRGB 169 179 192, Lab lightness about 73 with a cool blue undertone. Fine isotropic sugar-like grain only, the same texture in every direction, no preferred grain angle, no diagonal drift. Absolutely no ridges, no stripes, no sastrugi, no plates, no slabs, no dunes, no ripples, no waves, no footprints, no tracks, no cracks, no bare ice, no rocks, no dirt, no melt, no large dark patches, no large bright patches. Matte dry snow, not glossy, not chrome, not wet, not sparkling. Seamless tileable material. About half a metre of ground across the square frame.
- **Native size:** 1024×1024 (Imagine JPEG, saved as PNG, no wrap)
- **sha256:** `c4c44fb35b4a446578a2c1d51a513450bee6a78462a66d563c81bab563c2365a`
- **Column score:** 2.311 at heading 90°, offset (0.13, 0.37); **1/78** over 1.5. Under still 3’s offline worst; fewest overs in the set.
- **CIE76 mean Lab vs still 3:** 6.315 (pass). Mean Lab L=76.607 a=-1.198 b=-2.659.
- **Low-freq:** inner rowSwing 6.68, colSwing 4.14.
- **Eye, 4×4:** Even, no tile grid, no plates, no columns. Clearer fine diagonal grain than v2-0/v2-1 (closer to still 3’s grain direction, without still 0/1/2’s large slabs).
- **Verdict:** PASS, with a soft on grain direction

## Imagine calls

**12 calls** (11 images + 1 failed call that wrote no pixels). Stopped once four stills passed. Cap was about 16.

| call | id | result |
| --- | --- | --- |
| 1 | probe-00 | FAIL. 4×4 shows a strong repeating brightness grid (top-to-bottom gradient, top−bot +8.8 luma). CIE76 7.57 would have passed. |
| 2 | gen-01 | PASS → snow-v2-3 |
| 3 | gen-02 (first try) | No image. Reference path was under `/tmp`; GenerateImage requires `/workspace`. Not counted as pixels, counted as a call. |
| 4 | gen-03 | PASS → snow-v2-0 |
| 5 | gen-02 (retry, still 3 as colour reference) | FAIL. Copied still 3’s diagonal wind ridges. Colour was close (CIE76 5.33). |
| 6 | gen-04 | FAIL. Fine isotropic grain and good CIE76 (5.47), but 4×4 shows repeating horizontal bands. Offset wrap did not remove them. |
| 7 | gen-05 | FAIL. Strong diagonal washboard / plates. CIE76 4.21 would have passed. |
| 8 | gen-06 | FAIL for this pack. 4×4 is acceptable and CIE76 4.00 is close, but offline column worst **4.274** (15/78 over 1.5) is worse than still 3 (3.175). Kept in `raw/gen-06.jpg` only. |
| 9 | gen-07 | PASS → snow-v2-1 |
| 10 | gen-08 | FAIL. CIE76 **11.27** (too pale / paper-white). 4×4 was otherwise even. |
| 11 | gen-09 | PASS → snow-v2-2 |

Raw Imagine JPEGs and rejected wraps live under `raw/` and `tiles/`. Check scripts are in `tools/`. Precheck JSON is in `logs/`.

## Notes for the next engine tip

- These files are review stills only. They are not installed in the PR tree.
- After a Core tip that points the snow array at these four, the official `test-still-columns.mjs` chase (limit 1.5) still has to be run. The offline scores above are not a substitute.
- snow-v2-0 and snow-v2-1 are a little paler than still 3 (CIE76 7.7–8.9, still under 10). snow-v2-2 is the colour match.
- Ice was kept matte; no chrome.
- Disk after this work: about 15 GB free (floor was 5 GB).
