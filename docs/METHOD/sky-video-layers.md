# Sky video layers — planet, nebula, clouds, shooting stars (any biome)

Back to [METHOD.md](../METHOD.md) · base sky recipe: [sky.md](sky.md). **Status: IN TEST** — written 2026-10-06 from the zone B (Ember Mesa) planet takes. The owner has not validated a planet yet. The standing rules (2, 3, 9) and laws 64, 65 and 67 are unchanged. This page is how to obey them for every animated sky element.

The base sky is nearly empty (gradient + distant stars). **Each animated element is its own looping Imagine video layer**: planet, nebula, clouds or haze, shooting stars. The planet is the first worked example (§3–§7). The same rules hold for every layer (§1, §2, §5, §6).

Audit proof for this page: [`docs/reports/zone-b-planet-audit-20261006/`](../reports/zone-b-planet-audit-20261006/) (source record and layer check). The contact sheet (frames, seam diff, band strips, 1:1 crops, phone size, pixel chain) is `/workspace/zoneb-planet-audit.jpg` on the shared box; it is not in git.

## 0. Hard rules

| # | Rule | Check |
|---|---|---|
| H1 | **No pixel loss (SmiR).** The shipped layer file holds the Imagine original's decoded frames, unchanged. Allowed: stream copy (`-c:v copy`) to drop the audio track and the cover picture, and keeping a subset of the original frames. Banned: `-vf scale`, crop, `-crf` / `-b:v` re-encode, fps change, colour pass, "phone budget" re-encode, re-encoded trims. | `python3 tools/sky/layer_source.py check --shipped <layer>.mp4 --record <layer>.source.json --mag <m> --canvas-w 720` exits 0. Selftest: `python3 tools/sky/layer_source_selftest.py`. |
| H2 | **Highest source the mode allows.** Ask for 720p or 1080p. Imagine's default is 480p (zone A loops and the step 1e planet are 848×480). Pinned first/last frames, keyframes, or reference images cap at 720p (law 64 §B). Stills at the **2k** token, measured. | `ffprobe` row in the take report. A 848×480 layer needs a written reason. |
| H3 | **Displayed at magnification ≤ 1, and close to 1.** Never enlarge. Do not waste: a mag of 0.56 drops 44% of the decoded pixels before the phone sees them. Frame the subject tight in the cook instead of shrinking the frame in play. | `planetInfo` / `snapshot().magSources`; the `magnification` row of `layer_source.py`. |
| H4 | **Motion is proven on the frames, not on a mean diff.** Rotation means bands and features travel together in one direction. A fade, a glow, a swelling storm, or a storm sliding over still bands is not a rotation. | §6 rotation row: band-strip shift and a 3×3 frame tile. |
| H5 | **The loop meets.** Wrap step ≤ 1.5× the median frame step, and no hold above 0.4 s. Never a hard restart. | §6 seam row. |
| H6 | **Phone caps.** Decoding videos ≤ 4 including Bolt, drawCalls ≤ 12, texMB ≤ 260 (a 720p video texture is 3.69 MB, a 1080p one is 8.29 MB). | Perf line on the phone pose. |

## 1. Layer table

| Layer | Background in the cook | Key in play | Source size | Loop | Placement |
|---|---|---|---|---|---|
| Planet (+ moons) | Flat chroma green. A black background cannot be keyed without eating the night side (failure 2026-10-05, luma key). | Soft green excess + one-texel min + despill, blend on | 720p pinned loop (proven), 1080p single-image (untried, §4 B2) | 6–10 s; first frame = last frame | One camera-facing card at the chase heading, under the painted top, inside the dome radius |
| Nebula / aurora drift | Pure black | Additive from the video's own RGB, low gain | 1080p single-image i2v preferred | 13 / 17 / 29 s family (co-prime) | GPU-instanced tiles at mag ≤ 1, per-tile time offsets ([sky.md](sky.md) Part 2) |
| Clouds / haze | Pure black (or chroma green when the cloud is dark) | Luma or green key, gain ~0.28 | 720p–1080p | Different period from the others | A few large cards (zone B haze: four cards, mag 0.75). Never on the 17×8 dome grid (scratch field, failure 2026-10-04) |
| Shooting stars | Pure black | Key the streaks (0.30) | 720p | One-shot clip with a random gap ≥ 30 s, or a sparse loop | Scattered tiles, each on for part of its own period ([sky.md](sky.md), PR #165). Never a full-dome grid |

The stack order in the frame: base dome → planet → haze → world solids. Haze crosses the planet. Near solids (mesas) may cover its lower limb.

## 2. Where a sky layer loses pixels — zone B pixel chain (measured 2026-10-06)

The current zone B planet is `packs/zone-b/src/sky/planet-body.mp4`, sha256 `4069252f2c99…`, from commit `c0b32c0` (2026-10-05 07:42 Paris). That commit is on the local branch `zone-b-step1-ground-sky` in `/workspace/bv`. It is **not pushed**: GitHub's `zone-b-step1-ground-sky` stops at `ca70217`, and draft PR #175 (`cursor/zone-b-local-harden-c924`) carries the older file `d9afe4a5…` from `857ac3c`.

| # | Step | Size | Video bitrate | Done by | Pixel loss |
|---|---|---|---|---|---|
| 0 | Imagine stills that staged the storm (session `01a10a82…`, `images/1–6.jpg`) | 1280×720 JPEG | — | Imagine image, **1k token** | Ceiling. The 2k token was not used. |
| 1 | Imagine video, session `01a10a82…/videos/1.mp4`, 1,919,656 B | 1280×720, 24 fps, 145 frames, H.264 High@4.1 yuv420p, + AAC + MJPEG cover | 2,337 kb/s (0.106 bit/px) | Imagine Video, opening frame pinned as the last frame + mid keyframes = reference-to-video | **Ceiling 1: 720p cap** (law 64 §B). **Ceiling 2: soft generation.** The disk holds about half the 720p grid in real detail: Laplacian mean 2.4 (moons 9.7), Lanczos 0.5× down/up error 0.67 grey levels, 0.6% of disk energy above 1/8 Nyquist. |
| 2 | `ffmpeg -map 0:v:0 -c:v copy -an` (recipe `zone-b-planet-spin.md`), 1,767,585 B | 1280×720 | 2,337 kb/s | Commit `c0b32c0` | **None.** Same H.264 elementary stream (md5 match) and the same 145 decoded frames (framemd5 match). `layer_source.py check` PASS. |
| 3 | `<video>` element: muted + playsinline before `src`, 48×48 CSS at opacity 0.04 | decodes 1280×720 | — | Commit `5238234` | None. `videoWidth` is native. |
| 4 | `drawImage(v, 0, 0, 1280, 720)` into a scratch canvas, then `texImage2D` RGBA8 | 1280×720 | — | Commit `5238234` | None (same size, 8-bit). |
| 5 | `planet.json` `mag` 0.5625 → card drawn at 720×405 canvas px; video texture `LINEAR`, no mipmaps | 720×405 | — | Commit `857ac3c` (`fitPlanetSource` caps at `W / srcW` = 0.5625) | **Culprit A.** 44% of the decoded width (68% of the pixels) never reaches the screen. A 1.78× minification through one bilinear 2×2 tap skips texels: the ring grooves and the ring's gold rim alias and shimmer. |
| 6 | Canvas backing store fixed at 720×1600 | 720×1600 | — | `packs/zone-b/play/index.html`, `W`/`H` in `play.js`; the law 65 `fullscreen` row | **Culprit B (all packs).** 720 samples across the whole screen. |
| 7 | CSS `100vw × 100vh` on a 412×915 CSS phone at DPR 2.625 (1080×2400 physical) | 1080×2400 | — | Browser | **Culprit B, second half.** 1.5× bilinear upscale. 0.67 distinct samples per physical pixel. |

Net path: **1280 → 720 → 1080**. The disk is 657 source px → 370 canvas px → 555 physical px (212 CSS px, 51% of the screen width). The file is not the problem: no script, crf, or scale ever touched it. The pixels are lost at the Imagine source ceiling (steps 0–1) and in the draw path (steps 5–7).

Older planet files were also Imagine originals, byte for byte: `planet.mp4` (8f5cf5c) = session `01a10752…/1.mp4` (848×480, 452 kb/s, Imagine default 480p); `planet-body.mp4` at a2f4309 = `01a107f5…/1.mp4` (1280×720, 889 kb/s); bcd42df = `01a10855…/2.mp4` (2,122 kb/s); e266efb = `01a10855…/3.mp4` (1,392 kb/s); 857ac3c = `01a108e4…/2.mp4` (1,294 kb/s); `5238234` stream-copied that file (same 145 decoded frames). Session folders: `/workspace/x-live/chrome-game-home/.grok/sessions/%2Fworkspace%2Fgrokcli%2FzoneB*/`.

**Rule from this chain (H1 + H3).** Each new layer commits `<layer>.source.json` (`layer_source.py record`) next to the mp4, and the take report pastes the `check` output with `--mag` and `--canvas-w`. Add `--phone-px 1080` to print the phone upscale as an INFO row. A FAIL on `pixels`, `size`, `fps`, or `magnification` stops the take.

## 3. Attempt history — zone B planet (2026-10-04 → 2026-10-05)

Times are Paris. Commits are on `zone-b-step1-ground-sky` unless marked.

| When | Commit | Asset | What happened | Why it failed / lesson |
|---|---|---|---|---|
| 10-04 10:48 | `5bb1b5d` | planet painted inside horizon slice 2 (heading ≈ 75°) | Not in the chase or eye-level frames (heading 255°, 22.7° field) | A landmark baked into a slice. A planet is its own layer, placed where the chase looks (failure 2026-10-04, landmark in an off-heading slice). |
| 10-04 14:39 | `bd60e60`, `effe4a9` | `planet.png` 493×228 keyed crop, eye-locked card, heading 259°, el 13.5°, 380 m, mag cap 0.94 | A still card | Small source. A still is not a living layer. |
| 10-04 17:35 | `8f5cf5c`, `bf4dd5e` | `planet.mp4` **848×480** (452 kb/s) colouring only a feathered disk; rings and moons stayed the still | The card vanished once (alpha 0.004 with blending on). A cleaner script saved an empty `planet.png`. | 480p default. Half-video, half-still. Alpha sentinel + blend (failure 2026-10-04). Measure before saving. |
| 10-04 20:39 | `a2f4309` | `planet-body.mp4` 1280×720, 889 kb/s, whole planet + moons keyed, heading 180°, el 15°, 380 m, mag 0.5 | Owner: "make the planet look much more realistic" | Clip-art look (taste 2026-10-04). |
| 10-04 22:02 / 22:15 | `bcd42df`, `e266efb` | photoreal recook 2,122 kb/s, then replacement 1,392 kb/s | A dark oval opened mid-loop. The neighbour luma key ate a moon. A thin jagged moon fringe stayed. Video budget 3/3. | The luma key eats dark features (failure 2026-10-04). |
| 10-04 23:16–23:24 | — | — | Owner FAIL ×4: "ça va pas du tout" (crossing rings, ragged moons with a dark fringe) · "là c'est juste une image" · no stretching · planet must be BIG without losing quality | One coherent ring, soft edges. Video must play. Native aspect, uniform scale ≤ 1. Tight frame at the highest native resolution. |
| 10-05 00:31 | `857ac3c`, `ca70217` | one keyed 720p ring video, 1,294 kb/s, el 13°, 560 m, mag 0.5625, camera-facing card, soft key 0.08–0.22, blend on | First video (ends pinned only) idled then snapped. The second, with one mid keyframe, shipped. | Audit 2026-10-06: **no rotation.** Block matching on 59 disk blocks gives a median shift of 0 px at every phase. Features fade in place. About 1 s near-freeze at the end, then a wrap pop of 7× a normal step. A black wedge sits on the far ring arc. |
| 10-05 06:12 → 06:55 | `5238234` (local only) | same pixels, audio + cover stripped by stream copy | Owner FAIL 06:12 on a Samsung S20 FE: "Planet is NOT moving on his phone. It looks like a still image." Fix: muted + playsinline before `src`, a 48 px live element, `play()` on touch, canvas `drawImage` before `texImage2D`. | Headless Chrome is not the phone. A 2 px element, an audio track, a cover picture, or a late muted flag can stop phone playback (failure 2026-10-05). Proof captures omit `?debug=1` (it throttles the clock). |
| 10-05 07:20 | — | — | Owner FAIL: "no video of the planet rotating on itself" | A glow or fade is not a spin (taste row). |
| 10-05 07:42 | `c0b32c0`, `0dcb853` (local only) | **current**: 1280×720, 2,337 kb/s; storm pinned left → centre → right → off; key 0.02–0.10 | Storm travels; seam meets | Audit 2026-10-06 (§7): the storm slides over **still bands**. Soft, drawn look; gold glow on the ring rim. |
| 10-05 12:29 | `d043ca6` (PR #175, draft, cloud branch from GitHub's `ca70217`) | the older `857ac3c` file | Play wires the mp4 when `planet.json` names it. The PNG is not uploaded. The page was not opened. | This branch does not have the phone fix or the spin file. |

## 4. The method, step by step (any sky video layer; planet values shown)

**A. Size first.** Decide the on-screen size, then the source.
- `displayed_px = native_px × mag`, with `mag ≤ 1` and aim for 0.75–1.0.
- Planet: the disk is ≥ 85% of the frame height. The ring and moons stay inside with a ≥ 6% margin (the current file sits 32–66 px from the edges; that is too tight). Use 16:9 when a ring is present, 1:1 when not.
- Count the texture: W × H × 4 bytes per video layer against texMB ≤ 260.

**B. Pick the Imagine mode (law 64).**
1. *Pinned loop (proven, 720p).* Pin the opening still as first and last frame. Add up to 4 keyframes strictly inside, on the 1/3 s grid. For a planet the keyframes are **the same planet turned on its axis** (e.g. 0°, 60°, 120°, 180° of longitude) — edits of one master still, not new storms. Ends alone, or one mid keyframe, hold the disk still (failures 2026-10-05).
2. *Single-image 1080p (untried here, sharper).* One 2k still, no pins, prompt a slow rigid rotation, 10–15 s. Then keep a subset of frames whose first and last match (no new pixels; seam row). Try it once per biome before settling for 720p. Never ping-pong a rotation or a meteor: it reverses the motion.
3. Nebula, clouds, haze: single-image 1080p first. Drift may ping-pong. Shooting stars: a one-shot clip on a random gap ≥ 30 s, or a sparse loop.

**C. Stills.** Generate the master still at the **2k** token and measure it. Stage keyframes as edits of that master. An edit asked to "turn the clouds" can return a near-copy; a fresh master still, then edits of it, worked (take note 2026-10-05).

**D. Prompt rules — planet** (paste-ready wording lives in the skill [`boltverse-imagine-prompts`](../../.grok/skills/boltverse-imagine-prompts/SKILL.md)).
- Photograph, not illustration: spacecraft photo of a gas giant, fine cloud texture, true colour.
- One sun from the zone's sun side: a real terminator and night side, limb darkening, ring shadow on the disk. A dark limb is correct shading, not a defect.
- Centered, whole planet, ring and moons inside the frame with margin. No crop.
- Background: one flat chroma green, no gradient, no vignette, no stars. No glow, rim light, halo, outline, lens flare, or bloom on any edge (the current ring carries a gold glow line).
- Ring: one thin ellipse, behind the planet at the top and in front at the bottom. Moons: separate, clean edges.
- Video: locked camera, no zoom. "The planet turns slowly on its axis; cloud bands and storms move together across the disk at the same speed; no morphing, no new storms appearing, no swelling."
- Other layers: pure black background, locked camera, slow motion, first frame = last frame where the mode allows it. Shooting stars sparse, varied directions.

**E. Ingest (lossless).**
```bash
ffmpeg -i <session>/videos/N.mp4 -map 0:v:0 -c:v copy -an -dn packs/<zone>/src/sky/<layer>.mp4
python3 tools/sky/layer_source.py record --source <session>/videos/N.mp4 --out packs/<zone>/src/sky/<layer>.source.json
python3 tools/sky/layer_source.py check --shipped packs/<zone>/src/sky/<layer>.mp4 \
  --record packs/<zone>/src/sky/<layer>.source.json --mag <mag> --canvas-w 720 --phone-px 1080
```
There are no encoding settings to choose. The shipped encode is Imagine's own (H.264 High, yuv420p, 24 fps, one I-frame, 1.3–2.3 Mb/s at 720p for these clips). A single I-frame is fine for a loop: the seek goes to frame 0.

**F. Play code.**
- One decoder and one texture per layer. Upload only when a new frame exists (`requestVideoFrameCallback`, or the `getVideoPlaybackQuality().totalVideoFrames` stamp). Hold the last frame on a loop seek.
- `muted`, `defaultMuted`, `playsinline` before `src`. A live element of 48 px at opacity 0.04 (not 2 px, not `display:none`). `play()` on the first touch and on stick moves.
- Poster never covers a ready frame. Do not upload the PNG when a video exists.
- Planet card: faces the camera (camera up and right, not world up, or the ring flattens). Placement from `planet.json`: heading where the chase looks (zone B 180°), elevation such that pitch + half the vertical field stays under the painted top (zone B 13°; failure 2026-10-04 black cap), distance inside the dome radius (560 m < 640 m), `worldH = mag × srcH × distance / FOCAL`. Depth test on, depth write on, blend on.
- Planet key: green excess smoothstep 0.02 → 0.10, one-texel min, despill, discard alpha < 0.03, interior alpha ≈ 1. Never an alpha sentinel (0.004) with blending. Never a luma test on a planet.
- Video textures `LINEAR`, `CLAMP_TO_EDGE` (law 65 row 4).
- Caching: bump `?v=` on the mp4 URL after a replace (standing rule 7).

**G. Phone budget.** Count every layer in the ≤ 4 decoders (zone B chase: idle Bolt, haze, planet, beacon). drawCalls ≤ 12, texMB ≤ 260 (zone B chase: 10 draws, 245.1 MiB at `5238234`). A 6 s 720p clip is 1–2 MB on disk.

## 5. Loop rules (all layers)

- First frame = last frame by pinning when the mode allows it, or by a frame subset of a longer clip. Never a hard restart, never interpolated frames.
- Wrap step (MAD last → first, inside the subject mask) ≤ 1.5× the median consecutive step. No run of consecutive steps under 0.2 for more than 0.4 s ([sky.md](sky.md) pitfalls). The old planet failed both (wrap 2.26 = 7×, a 1 s hold); the current one passes (2.53 vs 2.01).
- Different periods per layer so the sky never repeats together (13 / 17 / 29 s family; the gate fails a combined repeat under 600 s).
- A rotation needs a loop long enough not to read as a jump: 6 s is the minimum, 10–15 s is better.

## 6. Quality checks before "done"

| Row | How | PASS |
|---|---|---|
| Source | `layer_source.py check` | Exit 0 |
| Rotation (planet) | Pick a horizontal strip inside one cloud band away from the storm. Measure its best x-shift between frames 0.5 s apart across the loop. Commit a 3×3 frame tile. | One direction in ≥ 80% of windows, and the storm moves with the bands. Zone B current: lower band 0 px in 12/12 windows → FAIL. |
| Drift (other layers) | Frame-to-frame gray MAE | ≤ 8 ([sky.md](sky.md)) and no repeating flash under 60 s |
| Seam | §5 | Both seam numbers pass |
| Sharpness | Laplacian mean inside the subject, Lanczos 0.5× down/up error, against the previous take | No regression. Record the numbers in the report. |
| Edge | Key the frame over a dark and a bright sky crop, 4× zoom | No green rim, no dark rim, no glow line. Soft band about 1 px. |
| Frame | Subject bbox vs frame edges | ≥ 6% margin, nothing cut |
| Phone | Two captures about 3 s apart in media time, with the wait inside `(t0 + 2.85, t0 + 4.2)` so the loop wrap cannot land both on one phase. `planetInfo().spinning` true. Report native, canvas, CSS, and physical sizes. | Motion visible; the budget line passes |
| Owner | Phone look | Only final KEEP |

## 7. Zone B planet today — audit 2026-10-06 and fix plan

Contact sheet: `/workspace/zoneb-planet-audit.jpg` (box). File: 1280×720 H.264 High@4.1, 24 fps, 6.042 s, 145 frames (1 I / 36 P / 108 B), 2,337 kb/s, bit-identical to the Imagine original. Object bbox 1166×654 px. Disk ≈ 657 px. Blockiness ratio 1.03 (no macroblocking). Edge soft band 1.05 px, and 21% of the 3 px inner rim is green-dominant before the despill.

| # | Problem | Numbers | Fix | Needs Imagine credit |
|---|---|---|---|---|
| 1 | **Not a rotation.** The storm slides left → right and swells. A new storm fades in on the left. The bands under it do not move. | Lower-band strip shift 0 px in 12/12 windows of 0.5 s. Upper band +15…+30 px, then −13 px (a swirl that reverses). | Recook by §4 B1 with keyframes that are the same master planet turned 60° per step, or try §4 B2 (1080p single image, rigid-rotation prompt, frame-subset loop). 10 s. | Yes: 1 master still (2k) + 3 edits + 1–2 videos |
| 2 | **Soft and drawn, not photoreal.** Flat lighting, no terminator or night side, a cartoon spiral, a gold glow line on the ring rim. | Disk Laplacian 2.4 (moons 9.7; the 857ac3c disk was 3.5). Detail ≈ half the 720p grid. | §4 C–D: a 2k photoreal master with one sun from the zone's sun side, terminator, limb darkening, fine cloud texture, no glow. Check sharpness against this take. | Yes (same cook as #1) |
| 3 | **Draw path drops and re-stretches pixels.** | 1280 → 720 (mag 0.5625, LINEAR, no mips, 1.78× minify) → 1080 physical (1.5× browser upscale). 0.67 distinct samples per physical px. | No credit needed, owner decision first: (a) size the backing store to the device pixels under the law 65 DPR cap (824×1830 on a 412 px phone at DPR 2; 1080×2400 needs the cap raised). This amends the law 65 `fullscreen` row and touches every pack. (b) Frame the next cook tighter so the planet's mag is 0.75–1.0. (c) Measure a mip chain on the planet texture (`generateMipmap` after each upload) while it is minified more than 1.3×. That amends law 65 row 4 for this case. Prove each with phone captures and the perf line. | No |

Smaller items: the frame is tight (32–66 px margins); the loop is 6 s (prefer 10 s); the moons are sharper than the disk, which flattens the depth read.

**Credit plan (not spent).** One 2k master still, three keyframe edits (60° steps), one 720p pinned video, plus one 1080p single-image try. About 4 images and 2 videos. Stop after 2 attempts at the same defect (standing rule 10).
