# Sky — the base recipe (any biome)

Back to [METHOD.md](../METHOD.md). **Status: IN TEST** — zone A step 2b rebuilt the living sky on branch `zone-a-step2-sky`.
Only SmiR approves it on the phone. The METHOD sky row (2026-10-02, plus the 2026-10-03 instancing clause) stays the law.
This page is how to build it for every biome.

Palettes and exact Imagine prompt text stay in untracked `*.local.*` files and in
`/workspace/grokcli/out/<zone>-step<N>/provenance.json`. Do not copy them into this page or into code.

## Part 1 — Generic recipe

### 1. Inputs

| Input | Where | Used for |
|---|---|---|
| `timeOfDay`, `paint`, `mood` | `biome/kits/<id>.json` — `python3 tools/kits/kit.py show --id <id>` | Prompt slots only |
| `sun.azimuthDeg`, `sun.elevationDeg`, `sun.kelvin` | same kit | Which slice carries the sun or eclipse glow, and the light line in the prompt |
| `skySlicePlan` (8 headings, 60° HFOV, 45° step) | same kit | Ring layout. Never clone or mirror a column to fill a gap |
| `livingLoops` durations | same kit, about 13 / 17 / 29 s | Three co-prime video layers |
| Palette words | kit, and the untracked prompt file | Prompt slots only. Never a typed colour in the shader |

The ring is a far backdrop centred on the eye. It does not move with Bolt. Code places, blends, and keys Imagine pixels. Law 67 adds only fog whose colour is sampled from the Imagine horizon, one light grade, and a capped bloom.

### 2. Prompt templates

`{…}` are slots. Kit slots are copied from the kit. Palette and mood sentences live in the untracked prompt file. No hex in a tracked file.

**T-hero — first slice** (`image_gen`, 4:3). One continuous night or day sky. Put the kit sun or eclipse in this frame when this slice faces `sun.azimuthDeg`. Natural horizon silhouette only on the horizon band. No landmarks, no text, no second copy of the sky pasted beside the first.

**T-next — outpaint** (`image_edit`, the previous slice as the source). A new full-frame painting whose left continues the previous image's right edge. Same time of day, same sun, same mood. Do not mirror. Do not paste the source as a left-hand strip.

**T-close — last slice** (`image_edit`, up to three sources: the previous edge and the first slice). Continues the previous edge and also meets the first slice. One sun only.

**T-upper / T-high** — same chain with no horizon and no sun disk. Upper is the band above the horizon. High is the band under the cap.

**T-cap** (`image_gen`, square). A nebula field for the pole. The centre of the frame is what the player sees when looking straight up, so the centre must be part of the painting, not an empty disk.

**T-loop** — reuse a sealed seamless loop when one already passes `tools/sky/check.py`. A new loop is `image_to_video` or `reference_to_video` with first frame equal to last frame. Durations stay different (about 13 / 17 / 29 s). This CLI's video tool stops at 15 s, so a longer loop is an existing file or a ping-pong, not a hard restart.

### 3. Resolution and the ring

Native Imagine stills are about 1152×864 (4:3) or a portrait near 832×1248. The phone view is 720×1600, hfov 22.7°. That is about 32 px per degree across and 33 px per degree vertically. Magnification is screen px per source px and must stay ≤ 1.0 (law 65).

One native still cannot cover 45° of azimuth at that density (1152 px / 45° is about 1.24×). Two genuine outpaints, overlapped and crossfaded with their own pixels, can. Cutting a painting into narrow strips and pasting the strips side by side is not a join. A hard cut through the middle of a finished slice, to force a common width, is the same defect.

Join rule:

1. Search a horizontal overlap. Crossfade that overlap with the two images' own pixels.
2. If one slice is wider, crop spare pixels from the **outer edges**, never from the middle. Then the crossfade stays intact.
3. Copy a few blended columns onto both sides of a slice boundary so the neighbour match is the same pixels, and feather those columns back into the painting over a short run.
4. The shader crossfades the two neighbouring slices at every vertical joint (see *Vertical seams* below). It mixes the two Imagine images only. It never invents pixels and never smears one edge column across the joint.

**Vertical seams — neighbour crossfade (SmiR 2026-10-03: sky validated except vertical seams; seams fixed by crossfading neighbour slices, no new pixels).**
Each slice is drawn a little wider than its azimuth step, so neighbours overlap. In the overlap the shader shows both slices with a smoothstep alpha, from 1/0 to 0.5/0.5 at the joint to 0/1. A slice may widen only until its horizontal magnification reaches that band's own current limit (the larger of its width and height magnification). The band's gated mag therefore never rises (`seamOverlap` in `play.js`, `bandMag` uses it). The overlap is capped at 25 % of a slice step and is computed per elevation. Higher up, `cos(el)` gives more room, and the slice keeps a constant angular width instead of being squeezed. The slice files, the download, the living video layers, the camera, the ground and the rocks do not change. Mip level comes from `textureGrad` with the analytic UV derivative, so the joint has no mip line.
Zone A numbers: horizon 25 % overlap at every elevation (about 6.9°; width mag 0.70 → 0.88, still under its 0.98 height mag). The upper band is already at width mag 0.998 at its 19° bottom, so its overlap grows with elevation: 0 % at 19°, about 3 % at 23°, 9 % at 30°, 15 % at 35° and 25 % from about 41°. The high band goes from 4 % at 52° to 25 % from about 59°. Do not widen past these limits to hide the low upper joint. That would stretch pixels.

Display each joined slice over 45° (the cook HFOV is 60°; the step is 45°). Stack bands so each band's height covers its elevation span at ≤ 1.0:

| Band | Role | Elevation (zone A numbers in Part 2) |
|---|---|---|
| Horizon | ground line, sun or eclipse | from just under the horizon up through the low sky |
| Upper | nebula above the horizon | overlaps the horizon top |
| High | under the cap | overlaps the upper top |
| Cap | pole | starts where a 1024 square still is still ≤ 1.0 (near 76°) |

Do not stretch a short band down to a low cap. A lat-long band pinches near the pole. The top of the dome is the cap, with polar UVs and **no edge clamp**.

### 4. Instanced living layers

Each video decodes **once** into **one** texture (`texImage2D` / `texSubImage2D` per frame). Draw it as **one** instanced draw per layer (`drawArraysInstanced` or `drawElementsInstanced`). Per-instance attributes carry tile azimuth, elevation, tile size, UV offset, and a phase so neighbouring tiles are not on the same part of the frame. No per-tile video element. No second copy of the decoder.

Map each tile at magnification ≤ 1. A 848×480 frame over the whole 360° is about 13× and is a fail. Tiles near 21° by 11° pass. Repeat wrap on the video texture. `LINEAR`, never `NEAREST`.

Blend additive from the video's own RGB, light enough that the painted slices stay sharp. A heavy mix paints a grid of rectangles. Hold the last uploaded frame when `readyState` drops on a loop seek. Do not fade the layer out at one heading.

**Parallax (2026-10-03, no invisible relief for the sky).** The dome stays on the eye. A small extra yaw, in radians, shifts the sample:

| Layer | Yaw factor | Role |
|---|---|---|
| Stars | 0.002 | farthest, nearly still |
| Painted slices | 0.006 | far backdrop |
| Nebula wisps | 0.012 | nearer drift |
| Dust | 0.020, plus a tiny term from eye x+z | nearest |

No stretch. Magnification stays ≤ 1. The mesh does not follow Bolt across the ground.

### 5. Fog

`sampleHorizon` reads the Imagine horizon band (zone A uses rows 72–90 % of each horizon slice) and passes that colour to the fog. Never type a fog colour.

### 6. Gates

`python3 tools/sky/check.py --manifest <sky.json> --out <dir>` must pass. It fails when:

- a slice join or the closing join is over the MAE limit
- slice-median exposure swing is over 24 in the ring
- a column run is a clone or a mirror
- an interior window repeats the same motif, mirrors, copies the other half, or a hard seam sits inside the slice (and the same between neighbour interiors)
- a living loop is not seamless, too short together, or over the texture budget (layer `texBytes` only, 48 MiB)
- `display.videoTiles` is missing while layers exist
- **any** displayed band, cap, or video tile is over magnification 1.0 at 720×1600

The old layout (one 848×480 frame over 360°) fails that last row. `python3 tools/sky/selftest.py` proves the fail and the pass. `tools/playcheck` does the same on `snapshot().magSources` (every sky key, including the video layers).

Also: root `npm test`, `tools/playcheck` `npm test`, play `mag_max` ≤ 1.0, `activeVideos` ≤ 4, no console errors.

### 7. QC list (phone, 412×915 CSS, DPR 2)

Look at the pictures. A passing number has shipped a washed sky before.

1. Each slice file alone: one continuous painting. No vertical strip edges, no pasted patches, no ruler horizon.
2. Contact sheet of the ring.
3. Headings 0, 90, 180, and the sun azimuth, at Bolt eye height.
4. Look up about 45°, straight up, and the highest crest.
5. A frame on each side of every layer's loop restart. Sky MAE across that pair should stay near a twinkle, not a flash.

## Part 2 — The Howling Eclipse (zone A, what was built)

Kit `howling-eclipse`: night, sun azimuth 285°, elevation −4°, 7500 K. Eclipse glow sits in slice 6 (heading 270–315), left of that slice's centre.

**Current layout — IN TEST (zone A step 2d, SmiR look-validated 2026-10-03 except the vertical seams, which are now crossfaded):** 13 slices per band (about 27.7° each) on the horizon and upper bands, 8 × 45° on the high band. This replaces the 8 × 45° horizon/upper rows of step 2b. The METHOD rail (8 × 60° HFOV) stays the law until SmiR approves this layout.

| Band | Files | Size | Elevation | mag (gate) |
|---|---|---|---|---|
| Horizon | `packs/zone-a/src/sky/sky-0..12.jpg` (13 × 27.69°) | 1248×832 | −1.5° to 23° | 0.980 (height); width 0.88 with the 25 % joint overlap |
| Upper | `src/sky/upper/sky-0..12.jpg` (13 × 27.69°) | 832×1248 | 19° to 56° | 0.998 (width at 19°) |
| High | `src/sky/high/sky-0..7.jpg` (8 × 45°) | 1152×864, shown 930 wide | 52° to 77.5° | 0.982 |
| Cap | `src/sky-cap/zenith.png` | 1024×1024 | from 74.6° | 0.989 |
| Stars / dust | existing mp4, 13.0 s and 16.708 s | 848×480 tiles 21.18°×11.25° | full dome, low gain | 0.792 |
| Corona (nebula slot) | Imagine loop, 3.3 s, one keyed tile near azimuth 285° | 848×480 | one tile | 0.792 |

Horizon and upper are two chained outpaints per 45° slice. High is one still per slice. Step 2b left repeated and mirrored slices in the ring. Step 2c stopped after two failed horizon outpaints of the same defect and did not install a new slice. The stills are lossy-encoded at the same pixel size. The cap file is unchanged. Bands overlap by several degrees (horizon/upper and upper/high) and the pole mesh is a fan, with cap UVs held inside the painting. The third living layer is a short corona loop, keyed from its own bright pixels and drawn on one tile near the eclipse azimuth. Stars and dust stay low-gain full-dome tiles. One instanced draw per layer. Play snapshot this step: mag_max 0.989, activeVideos 4, drawCalls 7, texMB 202.7. `packs/zone-a/src` download is 42.7 MB (was 79.3 MB at the previous commit). First sky frame during boot was about 1.7 s. The 48 MiB sky gate still counts layer `texBytes` only.

Play code: `packs/zone-a/play/play.js`. Manifest: `packs/zone-a/src/sky/sky.json` (`display.bands`, `display.cap`, `display.videoTiles`).

## Part 3 — Other biomes (ideas only, not cooked)

**Ember Mesa.** Same three bands and the same instanced loops. The hero slice carries that kit's low sun on the horizon band. The upper and high chains drop the night-violet mood slot and use the mesa dusk mood from the kit. Dust duration stays the long loop. Cap is a hot high haze, still a full painting at the centre.

**Cascade Verdance.** Same skeleton. The horizon band keeps a soft tree line with no landmark. Living layers lean on the mist loop rather than a bright nebula, still at magnification ≤ 1 and still one instanced draw. The cap is canopy-gap sky, not a black disk.

## Pitfalls

Step 2 (Director QC 2026-10-03), still in force:

- One 848×480 frame stretched across 360° and mixed heavily: about 13× magnification and a washed sky. The slice-only mag can still read under 1.
- Fading that veil out at azimuth 0: a vertical brightness step at heading 0.
- Cap UVs clamped from the ring top up to about 77°: a smeared slab, radial facets, a pole notch.
- `uploadVideo` returning false on the loop seek: the layer drops for a frame. Hold the last upload.
- Sun glow present in the slices and buried under a heavy layer.

Step 2b, new:

- A centre crop that deletes the middle of a joined slice and concatenates the sides. The edge gate stays green and the slice file shows a hard vertical seam. Crop the outer edges instead.
- Stamping eight identical columns makes join MAE 0 even when the clouds on either side of that stamp do not continue. Look at heading 0. Do not trust the MAE alone.
- Instanced tiles at a high additive gain draw a visible grid of rectangles. Keep the gain low. The painted slices are the hero.
- A square cap whose centre is a dark void becomes a dark disk at the pole, and the eight lat-long joins read as spokes when looking straight up. A 1024 cap cannot start much below 76° without magnification over 1. Do not fight that with an upscale.
- An outpaint that pastes the reference on the left (a diptych) is not a continuous painting. One redo, then crop to the continuous side or stop.
- Exposure swing is the slice-median jump, limit 24. Do not scale RGB in code to pass it.

Step 2b, Director visual QC 2026-10-03 (blockers, not merged):

- Outpaint clones: Imagine outpaints often repeat the reference motif two or three times across the new canvas. Each slice
  then shows the same cloud bank side by side. View every slice file alone before joining; the gates do not see it.
- Mirrored columns (kaleidoscope symmetry) in the upper band: same rule as cloned columns. Reject the image.
- Square patches with hard edges pasted inside a slice read as crop rectangles in play.
- Band-to-band edges (upper → high) show as a hard horizontal line when looking up 45°. Blend bands with their own
  overlapping pixels over several degrees, and check the look-up shot.

Step 2c:

- An outpaint that pastes the neighbour as a left-hand strip (a diptych), or that repeats the source cloud bank, is rejected. Two tries of the same horizon continuation, then stop. Do not install a panel that does not continue the neighbour edge.
- A slow pulse whose consecutive frames stay under the freeze MAE for more than 0.4 s fails the loop row. Keeping a subset of the Imagine frames (no new pixels) can clear that row. Do not interpolate new frames.
- Additive gain on a full video frame draws a rectangle even when the frame is mostly dark. Key the bright pixels of that frame and show one tile. Do not raise the gain of a structured full-dome layer.
- The interior motif gate misses a soft gap whose two halves are different paintings (upper slice 6). Do not lower the threshold until the kept slices are re-measured.
- The cap file's dark centre is part of the painting. Clamping the cap UV removes the edge smear. It does not repaint that centre. Do not upscale the cap.
- Green gates are not a pass: sky check, selftest, npm test and playcheck all passed with these blockers visible.

Step 2c, Director visual QC 2026-10-03 (blockers, not merged):

- A keyed corona video tile placed above the painted eclipse reads as a second, large, dark sun. One sun per sky: put
  the living corona on the painted eclipse, with the same position and size, or leave it out.
- Low-gain additive layers are not "living": the same view changed by about 1.3/255 over 12 s. Measure a same-view frame
  difference with the videos actually playing, and look at it on the phone at normal speed.
- A frame-step capture that pauses the videos also stops texture uploads (`uploadVideo` skips paused videos). Keep
  `paused` false while stepping `currentTime`, or the motion proof shows nothing.

Seam fix, 2026-10-03:

- Mixing the joint toward one edge column of the next slice (the old in-shader seam) smears that column across the joint. That is an infinitely magnified column, and the cut still shows. Crossfade the real overlap of the two slices instead.
- Copying a wide blended strip onto both sides of a joint puts the same strip twice side by side, which is a cloned column. Keep any baked shared strip to a few pixels.

Step 2d, Director visual QC 2026-10-03 (blockers, not merged):

- Fresh, unchained stills per slice end the clones inside a slice, but neighbours become unrelated paintings: hard seams
  and clashing styles. Each fresh slice still needs a shared style source and a real edge match with its neighbours.
- The same Imagine image used for two slices is a cloned column at ring scale. The motif gate must also compare every
  slice with every other slice in its band, not only inside one slice.
- An additive streak loop at high gain tiled over the dome repeats the same parallel streaks on a grid. Shooting stars
  must be sparse in time and position: per-tile phase offsets, few streaks per frame, varied directions.
- A paused frame-step capture can miss a layer entirely. Prove motion with a real-time capture (CDP screencast) too.
