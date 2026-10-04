# Sky — the base recipe (any biome)

Back to [METHOD.md](../METHOD.md). **Status: VALIDATED** — SmiR 2026-10-03 21:56 Paris, on the phone, after the seam crossfade fix d74f367 (PR #159). Same force as APPROVED.
The validated version is the zone A sky in Part 2 (locked as sky v1, see [recipe progression](self-improvement.md#6-recipe-progression-versions-score-lock)).
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

**Shooting stars / streak loops (2026-10-03, IN TEST, numbers retuned in this follow-up after SmiR saw none on the phone).** A loop whose content travels (meteors, streaks) must not use the full-dome tile grid. Neighbouring tiles show different parts of the frame, so a streak stops dead at every tile edge and at the `fract` wrap line, and the same streaks repeat as a grid. Give the loop its own scattered tiles, the same size as the other layers so magnification does not change (0.792). Each tile shows the whole frame once (UV 0–1, no drift, no wrap) through a soft elliptical alpha window held inside the frame. Place the **window centre** (the tile may hang below it) where the **chase camera actually sees sky**. Zone A chase: pitch about −18° to +3°, vfov 48.1°. Sky shows from the relief silhouette (about 8–10° up) to about 27° up, and at some headings only a thin strip. Zone A numbers: 36 tiles over every azimuth, window centres 7°–18° up, no two windows overlapping. Window radii 0.40 × 0.16 of the frame (wide and short, about 17° × 3.6°), flat core to 55 %. Each tile is on for 32 % of its own 6–11 s period, with 0.8 s fades in and out. Key 0.30 from the loop's own brightness: it keeps the streaks and drops the cyan cloud wisps, which read as stains at 0.14–0.18. Gain 1.5. Still one decode and one instanced draw (`METEOR`, `buildMeteorTiles`, `uMeteor` in `play.js`). Measure it in the chase view, not in a free look: `out/meteor-seams/meteorrate.mjs` counts the seconds with at least one clear streak on screen, over 8 headings.

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

**Current layout — VALIDATED (SmiR 2026-10-03 21:56 Paris, on the phone, after the seam fix d74f367):** 13 slices per band (about 27.7° each) on the horizon and upper bands, 8 × 45° on the high band. This replaces the 8 × 45° horizon/upper rows of step 2b and, for the sky display, the 8 × 60° rail (SmiR approved this layout).

### Validated version (sky v1, locked)

| Piece | What was validated |
|---|---|
| Slices | Unstretched Imagine slices: magnification ≤ 1 on every band, no slice widened past its band's own limit |
| Ring | 13 slices per band on horizon and upper (about 27.7° each), 8 × 45° on high, cap from about 74.6° |
| Vertical seams | Neighbour overlap crossfade in the shader (two slices' own pixels, smoothstep, `textureGrad`, no new pixels), commit d74f367 |
| Living layers | GPU-instanced video layers (one decode, one texture, one instanced draw per layer) with per-tile time offsets |
| Dome | Closed: horizon, upper, high bands and the polar cap, no hole and no edge clamp |
| Depth | Parallax layers: small yaw offset by depth (table in Part 1 §4) |

**Accepted known issues** (declared, not blockers; do not spend Imagine quota on them):

- A faint joint may remain around 19–28° up (horizon/upper overlap, where the upper band has no room to widen).
- Two duplicated upper slices.
- ~~The streak layer reads as a meteor-rain grid instead of sparse shooting stars.~~ **Fixed 2026-10-03 (PR #165, IN TEST until SmiR's phone check):** the meteor loop now shows on scattered tiles, each on for part of its own period, instead of the same streaks on all 136 dome tiles. #165 put them 13°–58° up, above the chase view, and SmiR saw none. this follow-up moved them into the chase-view sky (36 tiles, window centres 7°–18° up). Measured at the spawn in the chase view: one clear streak every 4.3–6.7 s at the six headings that show sky. At 90° and 135° the chase camera pitches down 16–18° and shows almost no sky, so there are 0–2 events per minute there.
- ~~Meteor streaks stop or vanish at the slice joints (SmiR 2026-10-03 21:56).~~ **Fixed 2026-10-03 (same PR):** the cut was at the 17 × 8 video-tile edges and at the `fract` wrap inside each tile, not at the slice crossfade. Each meteor tile now shows the whole frame once through a soft alpha window held inside the frame, so a streak fades in and out and never stops dead at an edge. The meteor tiles carry no drift and never overlap. Left: a streak can still fade out early inside its window, and a streak from the same frame may show in two far-apart tiles at once (one texture, one frame).
- Darker zenith centre (the cap painting's own dark centre, see Pitfalls step 2c).
- A small load regression (first sky frame about 1.7 s during boot).

A new sky attempt replaces v1 only when it scores better without regressing any row above.

| Band | Files | Size | Elevation | mag (gate) |
|---|---|---|---|---|
| Horizon | `packs/zone-a/src/sky/sky-0..12.jpg` (13 × 27.69°) | 1248×832 | −1.5° to 23° | 0.980 (height); width 0.88 with the 25 % joint overlap |
| Upper | `src/sky/upper/sky-0..12.jpg` (13 × 27.69°) | 832×1248 | 19° to 56° | 0.998 (width at 19°) |
| High | `src/sky/high/sky-0..7.jpg` (8 × 45°) | 1152×864, shown 930 wide | 52° to 77.5° | 0.982 |
| Cap | `src/sky-cap/zenith.png` | 1024×1024 | from 74.6° | 0.989 |
| Stars / dust | existing mp4, 13.0 s and 16.708 s | 848×480 tiles 21.18°×11.25° | full dome, low gain | 0.792 |
| Meteors (nebula slot) | Imagine streak loop `nebula.mp4`, 11.04 s (step 2d replaced the 3.3 s corona) | 848×480 tiles 21.18°×11.25° | 36 scattered tiles, window centres 7° to 18° up (chase-view sky) | 0.792 |

Horizon and upper are two chained outpaints per 45° slice. High is one still per slice. Step 2b left repeated and mirrored slices in the ring. Step 2c stopped after two failed horizon outpaints of the same defect and did not install a new slice. The stills are lossy-encoded at the same pixel size. The cap file is unchanged. Bands overlap by several degrees (horizon/upper and upper/high) and the pole mesh is a fan, with cap UVs held inside the painting. The third living layer is the meteor loop, keyed from its own bright pixels and drawn on the sparse chase-view tiles. Stars and dust stay low-gain full-dome tiles. One instanced draw per layer. Play snapshot this step: mag_max 0.989, activeVideos 4, drawCalls 7, texMB 202.7. `packs/zone-a/src` download is 42.7 MB (was 79.3 MB at the previous commit). First sky frame during boot was about 1.7 s. The 48 MiB sky gate still counts layer `texBytes` only.

Play code: `packs/zone-a/play/play.js`. Manifest: `packs/zone-a/src/sky/sky.json` (`display.bands`, `display.cap`, `display.videoTiles`).

## Part 3 — Other biomes (ideas only, not cooked)

**Ember Mesa (zone B step 1) — built, IN TEST.** Not a lock. Does not replace sky v1.

Horizon: 10 slices × 36°, `sky-0.jpg`…`sky-9.jpg`, 1280×560, elevation 2.457°–19.15° (span 16.693°). Turn offset 15/360 places slice 7 on kit azimuth 255°. Upper: 13 files, 27.692° step, 19°–56°, read from `packs/zone-a/src/sky/upper/` (unstretched). High: 8 files, 45° step, 52°–77.5°, from `packs/zone-a/src/sky/high/`. Cap: `packs/zone-a/src/sky-cap/zenith.png` from 74.6°. No column was cloned or mirrored. An 8-column meet of each pair's own edge pixels is in the JPEG so join MAE reloads at 0.

Living layer: `dust.mp4` 848×480, duration 10.042 s, gain 0.30, key 0.42, one instanced draw, per-tile phase. Manifest also lists `stars.mp4` 13.0 s and `nebula.mp4` 11.042 s at gain 0 (not decoded). `offsetsSec` length 10, step 0.9 s. Tile 21.176° × 11.25°, mag 0.792.

`python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json` (2026-10-04): 7 failures. Joins pass. Motif: sky-2 mirror 0.689; sky-4 repeat 0.836; sky-5 repeat 0.922, mirror 0.658, copy 0.743; sky-6 repeat 0.970. Exposure swing 62 (limit 24). Dust loop PASS, amplitude MAE 4.63.

Play 720×1600, 120-tick gallop and headings 0/90/180/270: worst mag 0.998 (upper). Horizon 0.992, high 0.982, cap 0.989, ground ≤ 0.91, dust tile 0.792. drawCalls 5, texture bytes 187176279 (178.5 MiB), activeVideos 2, download 30078868 bytes. Same view, dust `currentTime` 3.30 s → 4.97 s over 1.2 s, sky-region mean abs difference 4.00.

Known issues (do not recook this step): gate rows above; reused upper band is what the chase sees above 19.15°; slice heights do not share one horizon row; some slices read nearer than a far silhouette; the dust frame still stamps structure inside its tile; visual period is 10.042 s. Step 2, if it replaces the reused bands: about 10 upper stills on the same 36° step, then 8 high and 1 cap (19 calls) if those must change too. Motif and exposure recooks of slices 2, 4, 5 and 6 are separate.

**Ember Mesa (zone B step 1b) — corrective, IN TEST.** 2026-10-04. Not a lock. Does not replace sky v1. Same assembler as zone A (`packs/zone-b/play/play.js`). Zone A files were not edited.

Horizon band only: the same 10 files, now the full 1280×720 frames, azimuth 36°, elevation −4.31° to 17.12° (span 21.43°, mag 0.990). No zone A upper, high, or cap path. Dust stays in the manifest at gain 0 and is not decoded. Dome radius 640 m, clip far 720 m, dome floor −0.22 rad, so the 480 m ground skirt is in front of the shell. Weight starts at the band bottom (the bottom texel is not smeared below the band).

Play 720×1600. Presented mag 0.990 on the proof poses and on an in-place turn. After the ground tile was set to 1.42 m, that turn measured ground mag 0.976 at heading 205 and butte mag 0.357. drawCalls 7, texture bytes 112143298 (107.0 MiB), activeVideos 1, heroCount 1, WebGL error 0. Headings 000, 075, 090, 180, 255, 270: same presented mag. Butte cards peak at 0.898 on the wide pose (measured before the tile change; the wide camera did not move).

`python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json` (2026-10-04, step 1b): 38 failures. The full frames do not carry the step 1 edge stamp, so joins fail (content MAE 4.13–23.94, close 19.05, limit 4). Motif rows fail on sky-0 through sky-9. Exposure swing 69 (limit 24). Combined repeat 10.0 s (one layer, limit 600 s). `python3 tools/sky/selftest.py` PASS.

Five open-sky stills were cooked for an upper band (1280×720, calls 1–5 kept, calls 6–7 rejected). They are not in the pack: five slices cannot close 360° at magnification ≤ 1 without a copy or a stretch. The chase still shows an empty cap above about 17°.

**Ember Mesa (zone B step 1c) — fix pass, IN TEST.** 2026-10-04. Not a lock. Does not replace sky v1. Zone A files were not edited.

Upper band added: 9 slices, azimuth 40°, elevation 12.0° to 30.5° (span 18.5°), each file 1280×620. Presented mag 0.993 (upper), horizon still 0.990. Five kept step-1b stills plus three new 16:9 frames. The fourth new frame had a desert floor and was not installed whole; only the sky above that floor was cropped in. Tops of the other eight were cropped so every layer is the same size. No column was cloned or mirrored. Nothing above 30.5° is painted. Dust gain stays 0.

`python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json` (2026-10-04, step 1c): 59 failures. Horizon joins, motif, exposure swing 69, and the 10.0 s combined repeat are the step 1b rows. The new rows are motif hits on `upper/sky-0.jpg` through `upper/sky-8.jpg`. `python3 tools/sky/selftest.py` PASS.

**Ember Mesa (zone B step 1d) — spectacle pass, IN TEST.** 2026-10-04. Not a lock. Does not replace sky v1. Zone A files were not edited. Horizon and upper slice files were not recooked.

The ringed planet lives in horizon slice 2 (heading about 75°). Chase and eye-level look at heading 255° with a 22.7° horizontal field, so that slice is outside the frame. Step 1d places one eye-locked card from a keyed crop of that planet: `packs/zone-b/src/sky/planet.png` (493×228), heading 259°, elevation 13.5°, distance 380 m, magnification cap 0.94 (`planet.json`). The card is drawn after the buttes, depth-tested, and it does not write depth. Alpha below 0.04 is discarded. The post pass grades the frame once; the card shader does not grade this key. One new Imagine edit. Presented mag on the proof poses stays 0.993. drawCalls 8. Texture bytes 141312386 (134.8 MiB).

`python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json` (2026-10-04, step 1d): 59 failures, the same rows as step 1c. `python3 tools/sky/selftest.py` PASS. Nothing above 30.5° is painted.

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

Meteor visibility, 2026-10-03 (PR #165 → this follow-up):

- Meteor tiles placed 13°–58° up looked right in free-look QC shots. The chase view only sees sky from about 8° to 27° up, so SmiR saw no meteors at all on the phone. Place living layers where the chase camera looks, and measure them in the chase view (rate per heading), not in aimed stills.
- A low luminance key on the streak loop brings back its cyan cloud wisps as bright stains inside the window. Key the streaks (0.30) and get brightness from gain and placement instead.
