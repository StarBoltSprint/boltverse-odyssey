# Failure log

Append-only. Add a new entry at the bottom. Do not rewrite an old entry to hide a miss. If a guard changes, add a new entry that cites the old one.

`feedback/` has no dated report. The only file there is [`feedback/README.md`](../feedback/README.md) (law [`biome/docs/66-tool-feedback-loop.md`](../biome/docs/66-tool-feedback-loop.md)). The entries below are taken from docs and commits already in this repo. Nothing here is a reconstructed prompt or a guessed measurement.

A search of the tree and `git log --all -S silhouetteFit` found no field named `silhouetteFit`. The fit measure that was added is `silhouetteIoU` in `tools/walkaround/primitive.py`.

## How to append

```markdown
### YYYY-MM-DD — <defect in a few words>

| | |
| --- | --- |
| Take | |
| Defect | |
| Root cause | |
| Fix | |
| Guard | command, row, and the number that fails |
| Sources | commits and files |
```

Leave a field blank when the repo does not say it. Do not fill it.

### 2026-09-30 — orbit views cooked without a silhouette lock

| | |
| --- | --- |
| Take | Doc 60 test 4. Not a numbered zone take. |
| Defect | Views of one object grew lobes on the sides and back. The set was not one object. |
| Root cause | The views were cooked with no silhouette lock against a single starting still. Eight consistent views are not an Imagine feature (a multi-image edit takes at most 5 sources). |
| Fix | Start from one sharp still (V0). Cook each next view, every 45°, as an Imagine image edit from that still and the previous view. Lock area within ±15% and height within ±8% of the neighbors. Reject a view that is not the same object as V0. No turntable video. |
| Guard | `python3 tools/objsheet/sheet.py` rows Adjacent (area ±15%, height ±8%), Opposite (width ±15%, height ±8%), Guide IoU ≥ 0.97 when a guide exists, Hull keep (any horizontal view under 0.70, or the mean under 0.80). Sample `tools/objsheet/samples/inconsistent` FAILs when two yaws are a different tall shape. `tools/assetcheck` kind `turntable` row `morph` FAILs a frame that moves area more than 15%, height more than 8%, or silhouette IoU under 0.75. |
| Sources | [`biome/docs/60-imagine-relief-panorama-method.md`](../biome/docs/60-imagine-relief-panorama-method.md) test 4 table and the KEEP method (commit `594deac`, PR #125). [`biome/docs/64-imagine-build-limits.md`](../biome/docs/64-imagine-build-limits.md) section C (commit `93c6ef0`, PR #140). [`tools/objsheet/README.md`](../tools/objsheet/README.md) (commit `a40f9c6`, PR #133). [`tools/assetcheck/README.md`](../tools/assetcheck/README.md). |

### 2026-10-01 — ring and circle layouts that the player cannot see

| | |
| --- | --- |
| Take | Take 8, 2026-10-01. |
| Defect | The edge ring was empty in the play view. Ground at 18 m with no ring. An invisible stop at 17.07 m, heading 333°. No visible gate at 238°. The validator had printed ALL PASS. A circle collider the size of the ring radius is the same class of fault: the hero stops on a wall that has no stones. |
| Root cause | Every check compared the layout file to itself. Hulls existed in the data, on the debug map, and in the colliders, and were not drawn. The console also had WebGL `texSubImage3D` `INVALID_OPERATION` (an array-texture upload that does not match its `texStorage3D` allocation draws nothing). |
| Fix | Judge the framebuffer of the play view. A collider centred on the zone whose radius matches `edge_ring.radius_m` is a ring wall, not a stop. `edge_ring.radius_m` is the placement centreline. Generate the file with `tools/layout`; do not hand-place the ring. |
| Guard | `tools/playcheck/run` rows `ring_closed`, `collider_eq_visual`, `layout_rendered`, `stops_visible`, `gate`, `webgl_errors`. The committed fixture `tools/playcheck/sample/take8/report.md` FAILs those rows (`ring_closed` renderMiss=35, `collider_eq_visual` bad=8, `gate` pixels=0). `python3 tools/layout/layout.py check` row `collider_eq_visual` counts `ring_wall` and fails. `tools/layout/sample/broken/NOTES.md` records a visual gap of 104° at 42.5° and an invisible stop at 17.37 m on seed 11. That sample is the same class of fault as the phone (a gap on the order of 103°, a stop on the order of 17 m). It is not a replay of the phone log. |
| Sources | [`biome/docs/63-layout-file-and-validator.md`](../biome/docs/63-layout-file-and-validator.md) critical lesson. [`biome/docs/62-open-world-zones-process.md`](../biome/docs/62-open-world-zones-process.md) take 8 FAIL. Commits `2983aef` (PR #130), `d7bb4cb` (PR #132), `5740ab9` (PR #134). [`tools/layout/README.md`](../tools/layout/README.md). [`tools/playcheck/README.md`](../tools/playcheck/README.md). |

### 2026-10-02 — nearest sampling on world textures

| | |
| --- | --- |
| Take | Take 10c, branch `take10c`, commit `ef19dda`. |
| Defect | World stills and video uploads were sampled with `NEAREST`. The picture aliases. Mipmaps were never built. |
| Root cause | `packs/zone-a/play/play.js` at that commit sets `TEXTURE_MIN_FILTER` and `TEXTURE_MAG_FILTER` to `NEAREST` on the world stills and on the Bolt and gate video uploads (around lines 135, 345, and 361). The same pair on the object-ID buffer (around line 107) is the one place `NEAREST` is allowed. The file does not call `generateMipmap` and does not set `LINEAR_MIPMAP_LINEAR`. That play file is not on `main`; the law cites the commit. |
| Fix | Stills use `LINEAR_MIPMAP_LINEAR` and `generateMipmap`. Ground anisotropy up to 8. Video textures use `LINEAR`. |
| Guard | `tools/playcheck` row `render_source` (rule `nearest_world`). Same scan without a browser: `node tools/playcheck/src/renderlint.mjs <play.js>`. Law 65 rule 4. |
| Sources | [`biome/docs/65-render-quality.md`](../biome/docs/65-render-quality.md) counter-example, commit `c2c753d` (PR #141). Source lines confirmed at `ef19dda:packs/zone-a/play/play.js`. [`tools/playcheck/src/renderlint.mjs`](../tools/playcheck/src/renderlint.mjs). |

### 2026-10-01 — silhouette hull blobs thin parts

| | |
| --- | --- |
| Take | Walk-around hull. Doc 62 names the blobby case. No separate phone take number is stored for a thin-part miss. |
| Defect | A 7-of-8 silhouette vote keeps the mass the views agree on. A thin part (a cannon, an antenna, a spur) that most views do not cover disappears, and the solid reads as a blob. Disagreeing views shrink the carve toward a blob and the hull-keep fraction falls. |
| Root cause | The occupancy vote is an intersection, not a union. A 3-voxel opening is only flagged. The tool does not cook that part and does not cut it out by itself. Parity voxelization of a fitted primitive can also miss a thin solid. |
| Fix | Supply the thin part as a `subObjects` entry with its own views, a joint, and an axis. The parent voxels past the joint are cleared and the part mesh is attached. When a rigid turntable exists and the default hull is too blobby, `--shape photogrammetry` is the opt-in. A box or a vertical cylinder uses `--shape primitive`; IoU is the fit measure, and a mean under 0.50 fails without switching methods. Surface nets (`c07c039`) replaced the chopped voxel surface. They did not replace the occupancy vote. |
| Guard | `tools/objsheet` Hull keep: any horizontal view under 0.70, or the mean under 0.80, or the volume collapses. `tools/walkaround` `qc/report.json` → `protrusions` (bbox and a suggested joint; a flag is not a PASS). Primitive stats field `silhouetteIoU.mean`; below 0.50 the report's `ok` is false (`tools/walkaround/primitive.py`). There is no `silhouetteFit` field. |
| Sources | [`biome/docs/62-open-world-zones-process.md`](../biome/docs/62-open-world-zones-process.md) steps 2 and 4, and the sentence that photogrammetry is for a hull that is too blobby. [`tools/walkaround/README.md`](../tools/walkaround/README.md) sub-objects and protrusions. [`tools/objsheet/README.md`](../tools/objsheet/README.md) hull keep. Commits `ab8d1dc` (PR #127), `c07c039` (PR #131), `a40f9c6` (PR #133), `7c9e419` (PR #138). |

### 2026-09-29 — a sky or hull video that drifts inside the frame

| | |
| --- | --- |
| Take | Relief plate 0, and the Void Orbit ship prototype. |
| Defect | An Imagine video used as the texture drifts, then the loop snaps back to frame 0. Asking Imagine to pan returned a dolly. Crossfading two cooks of one heading ghosted a second hull. |
| Root cause | The generator does not hold the subject still. Movement was pixels inside the picture instead of the camera or the group. |
| Fix | One locked frame (plate 0 is frame index 12, MAE 0 against `assets/relief/plate0.png`). Extend by image-to-image slices. Hard-paste pixels already kept. Do not ask Imagine to pan. The 360° ring copies columns 0..31 onto the last 32 columns (seam MAE 0) and maps that width to exactly 360°. The ship skin is stills. Top and nose were image-to-image from the flank so the design matches. A drifting ship video is forbidden. |
| Guard | `python3 tools/assetcheck/check.py` kind `backdrop` (width above 4096 must be split; vertical magnification > 1 fails; horizontal wrap uses the tile seam limits, ratio > 2.2 and absolute seam > 12). Kind `loop` fails seam MAE > 8, seam p95 > 28, or flow > 2 px. The relief outpaint itself is judged by overlap MAE (accepted about 0.02–3.5) and plate MAE 0, written in the doc, not by a second tool. |
| Sources | [`biome/docs/60-imagine-relief-panorama-method.md`](../biome/docs/60-imagine-relief-panorama-method.md) plate 0, T2, T2b, test 2d (commits `05a86ee` PR #123, `ad09768` PR #124, `594deac` PR #125). [`tools/relief/README.md`](../tools/relief/README.md). [`biome/docs/57-void-orbit-ship-relief.md`](../biome/docs/57-void-orbit-ship-relief.md) sections 2 and "What held" (commit `c83f082`). [`biome/docs/64-imagine-build-limits.md`](../biome/docs/64-imagine-build-limits.md) section D. |

### 2026-10-01 — one ground still frozen to the camera

| | |
| --- | --- |
| Take | Rocky Clearing attempt 1. Take 3 is the KEEP that replaced it. |
| Defect | A single ring or relief still upscales after about 4 cm of travel, so the ground froze: the HUD distance changed and the image did not. The HUD magnification was 0.406. The claimed figure was 0.990. |
| Root cause | One still cannot tile a walk. Pinning it to the camera to avoid the upscale leaves the floor stuck to the lens. |
| Fix | World-locked top-down Imagine tiles, about 0.90 m, at least 4 variants, on an invisible height relief. Take 3 phone QC read magnification 0.979 on the HUD and on the phone. |
| Guard | `tools/assetcheck` kind `tile` (seam ratio, exposure delta > 18, contrast ratio > 1.75, magnification > 1). `tools/layout` row `mag` against `view.mag_max` (1.0). `tools/playcheck` rows `mag` and `mag_max`. A HUD number that does not match the claim is a FAIL even when a tool has not run. |
| Sources | [`biome/docs/60-imagine-relief-panorama-method.md`](../biome/docs/60-imagine-relief-panorama-method.md) walkable ground, attempt 1. [`biome/docs/61-free-clearing-walk.md`](../biome/docs/61-free-clearing-walk.md) take 3 KEEP (commit `e4ba55e`, PR #129). |

### 2026-10-02 — rounded demo shapes passed the numeric gates

| | |
| --- | --- |
| Take | Owner review 2026-10-01/02. No numbered zone take is stored for these reactions. |
| Defect | A round paw-anchor emblem looked pasted on like a sticker. The earlier rounded egg-pod ship was ugly. Spherical and blob rocks, and identical capsule views, read as a demo. Orbit views of two different ships are not one object. Safe rounded shapes were chosen to pass checks. |
| Root cause | Area, height, and silhouette IoU measure agreement between views. They do not measure whether the shape is sharp, etched, or the design the owner kept. |
| Fix | Read `learn/taste.md` before a visual step. The Golden rule is first: a living painted film, Imagine pixels, the filmed Bolt gallop, the owner's decrees. Style rules: sharp edges, distinctive silhouettes, no circles, etched angular dark-violet weathered marks, large organic biomes, one ship across an orbit set. Append the owner's reaction after the review. |
| Guard | `python3 tools/judge/judge.py --candidate <still> --ref <ref>` (1–3 refs). The prompt includes the Golden rule and `learn/taste.md`. Exit 0 only when the reply is valid, score ≥ 7 (`--threshold`), `keep` is true, and `matches_refs` is true. `python3 tools/judge/selftest.py` checks the 128 KiB image-block cap and rejects a bad reply (exit 1). A judge score does not override a hard law and does not replace owner review. |
| Sources | [`learn/taste.md`](../learn/taste.md). [`tools/judge/README.md`](../tools/judge/README.md). |

### 2026-10-02 — orbit views drift in camera height and exposure

| | |
| --- | --- |
| Take | 10d, ship rounds r1, r2, r3 (Grok Build CLI, `cli/take10d-ship`). |
| Defect | Eight Imagine views of one ship were not shot from one camera. r2: yaw-000 came back as a plan view (luma +46%) and yaw-180 +29.5% luma, with mixed elevations across the set. r3 asked for 18° on every call and still passed only 4/8: yaw-000 hs_corr 0.218 (grey, not violet), yaw-045 luma +37.7% and keel tilt 22.1°, yaw-180 top fraction 0.214 vs hero 0.059 (too high) and wingtip margin 0.019, yaw-315 steep (top 0.204), luma +12.6%, tilt 24.7°. |
| Root cause | Imagine does not hold an elevation or an exposure across edits. End-on and front-quarter views are the worst: the model returns a plan or a steep view, and every edit drifts brighter. Text such as "eighteen degrees above the horizon" is not a camera lock. Asking for a level end view often turns the ship back to a side view. |
| Fix | Not fixed in take 10d. The stop rule ended it after 3 rounds. What helped: cook the hero first and gate it, then pass the hero as the first image of every view call ("match the first image's camera and darkness"), and change one thing per edit (rotation, then exposure). What is still needed: a per-view gate before keeping a plate (top fraction within ±25% of the hero, luma ±10%, keel tilt ≤ 20°), and a reference that fixes the camera, such as a rendered proxy at the right yaw/elevation as the second image. |
| Guard | Ship-run drift script rows (`ship-ref/VIEWS_READY.txt`): hs_corr vs hero ≥ 0.80, luma ±10%, top fraction ±25% (side) / not plan, not too high (ends) / ≤ 3× hero (quarters), keel tilt ≤ 20°, margin ≥ 3%. Not in the repo yet: no repo tool gates the elevation of an orbit set. `tools/objsheet` only gates area and height. |
| Sources | `/workspace/grokcli/out/take10d/ship-ref/VIEWS_READY.r2.txt`, `VIEWS_READY.txt` (r3), `drift-report.json`, `r3-prompts.jsonl` on the box. |

### 2026-10-02 — hull carve does not match its own views (silhouetteFit)

| | |
| --- | --- |
| Take | 10d attempt 2, ring-b rebuilt from the slab orbit (`c4436f2`). Cites "silhouette hull blobs thin parts" above. |
| Defect | The walkaround hull reprojected into each view covered a different shape than the view: ring-b IoU mean 0.596, min 0.470. Thin parts kept 0–13%. The overhang concavity was filled. The old primitive hulls scored 0.80–0.94, so a good-looking new rock produced a worse solid. Ship r1 views were refused by the silhouette lock. |
| Root cause | The 7-of-8 vote carves inconsistent Imagine framing (size and centre change per view) down to a core box. The underside cap fills any concavity. The silhouette lock's area rule is wrong for long objects. The texture then stretches over the shrunken hull. The report had no per-view fit number, so none of this showed up in `qc/report.json`. |
| Fix | Report only so far: `tools/walkaround/hull.py` writes `silhouetteFit` (per view: iou, missed, overfill; plus minIoU), `selftest.py` `check_silhouette_fit` (red on the old code: "report has no silhouetteFit.perView / minIoU"; green: good minIoU 0.914, shifted 0.6455). Local commit `40afc90` on `cli/take10d` (first `3052dcd` on `cli/take10d-ship`). Not done: per-view registration (scale and principal point, also in `hullmesh.js`), soft vote that protects thin parts, keeping concavities, an aspect-aware silhouette lock, and an IoU gate once a law sets the limit. |
| Guard | `python3 tools/walkaround/selftest.py` `check_silhouette_fit`. `qc/report.json` → `silhouetteFit.minIoU` (no PASS limit yet; take 10d used 0.85 as the target row `hull_silhouette_fit`). |
| Sources | `/workspace/grokcli/out/take10d/hullcheck/HULLCHECK.md`, `hullcheck.py`, `redgreen/` on the box. |

### 2026-10-02 — chroma key leaves a green edge band that the key gate does not count

| | |
| --- | --- |
| Take | 10d ship r3 views. |
| Defect | The keyed views had a dark green band along every edge: 35–98% of the pixels in a 3 px edge band leaned green (G > R+6 and G > B+6), visible on a grey contact sheet. The run's own key check said "key-green pixels inside every opaque mask: 0". |
| Root cause | The key gate only counted bright key green (G > max(R,B)+28 and G > 70). Dark spill on a near-black hull is under that threshold, so it stayed opaque. |
| Fix | Despill through the key: clamp G to max(R,B) and erode alpha 1 px. Result 0% green edge, luma −1..−3 (copy at `ship-ref/views-despill/`). |
| Guard | None in the repo. A row is needed: share of edge-band pixels with G > max(R,B)+6, limit about 1%. `tools/assetcheck` kind `cutout` does not measure edge spill. |
| Sources | Director measurement 2026-10-02 16:30 on `ship-ref/views/yaw-*.png`. |

### 2026-10-02 — sky slices made by cloning or mirroring columns

| | |
| --- | --- |
| Take | 10d. The interrupted web session's WIP commit `71a44b2` (branch `take10d-web`) installed the sky. Attempts 2 and 3 (Grok Build CLI) tried to replace it. |
| Defect | The installed sky-0..6 end in cloned or mirrored trailing columns. That is code-made pixels, a hard-law breach. The content-strip MAE between slices reaches 40.94 (limit 4). Attempts 2 and 3 cooked a real chain: 9 accepted slices (join content MAE 1.56–2.66, but Laplacian variance fell from 4546.81 on slice-00 to 915.99 on slice-08, so the chain softens with every edit). They did not close it, and then 8 rejects in a row broke the luma window (37.1–43.3). Attempt 3 reached 10 slices, still open at the 17:45 cutoff. The installed cloned sky stays in take 10d (owner 17:20: deferred). |
| Root cause | A chain with a tight luma window drifts darker or brighter with every edit, and the window narrows as slices are added. Cloning columns hid the missing width instead of cooking it. One slice (37) swung column luma by 62 and poisoned every chain that started with it. |
| Fix | Not fixed in 10d. Next time: score each new slice against the first slice's luma as well as the previous one, plan the closing slice early (an edit with the last slice and slice 0 as the two images), and do not start a chain from a slice that already swings more than 6. |
| Guard | Take 10d REPORT rows `sky_unique_sha256`, `sky_join_mae` (content-strip MAE ≤ 4), `sky_column_luma_swing` (≤ 6 in any 60° window). `tools/assetcheck` kind `backdrop` measures the seam and magnification, not cloned columns. No repo row detects mirrored columns yet. |
| Sources | `/workspace/grokcli/out/take10d/sky-chain/STATUS.md`, `work/measure-now/sky.json`, REPORT.md (take 10d). |

### 2026-10-02 — one oversize step per headless session, ending without a final answer

| | |
| --- | --- |
| Take | 10d, Grok Build CLI attempts 1 and 2 (and attempt 3 ran past the 18:15 deadline). |
| Defect | Attempt 1 ran 419 turns (8 compactions, $14) and ended with no final answer and no REPORT. Attempt 2 ran 290 turns (5 compactions) and ended with no final answer. Its REPORT had 33 rows "not measured". The phone playcheck, which takes about 40 minutes, never ran on a HEAD in either attempt. |
| Root cause | The step held about 10 items and more than 79 rows, plus art cooks. After each compaction the session re-read the spec and GROK.md, and the END pipeline was planned last. The session stopped (end_turn) in the middle of the work. |
| Fix | Attempt 3 put the measurement first (step 0: playcheck in a subagent in the first 20 minutes), wrote REPORT.md after every item, and used a fixed time cutoff. That gave a measured table. Next time: one art family per step, the playcheck at the start and at the end, and time the 40-minute playcheck into the deadline. |
| Guard | None in the repo. The kit has no check that a run ended with a final answer. The Director checks `.exit` plus the last `text` event. |
| Sources | `/workspace/grokcli/logs/20261002-120625-take10d.*`, `20261002-144151-take10d.*`, `20261002-163629-take10d.*`, `/workspace/grokcli/next/take10d.progress.log`. |

### 2026-10-02 — sky clone gate now rejects a copied or mirrored trailing run

| | |
| --- | --- |
| Take | Tooling follow-up to take 10d. Cites "sky slices made by cloning or mirroring columns" above. |
| Defect | The same cloned and mirrored trailing columns, and a chain that never closed. |
| Root cause | `tools/assetcheck` kind `backdrop` measured a wrap seam and magnification. It did not compare a trailing run with the run before it, and it did not require last-to-first. |
| Fix | `python3 tools/sky/check.py` fails a trailing clone or mirror, a content-strip join MAE above 4, a column-luma swing above 6 in any 60° window, and an open close. The report names the cheapest slice to recook. |
| Guard | `python3 tools/sky/selftest.py`. Join MAE limit 4. Swing limit 6. A chain that only fails the close recooks the last slice. |
| Sources | Take 10d sky entry above. Tool version that let it through: `db693e5`. Stills were on the take box and are not stored in this repo. |

### 2026-10-02 — dark green edge band is now a cutout fail

| | |
| --- | --- |
| Take | Tooling follow-up to take 10d. Cites "chroma key leaves a green edge band that the key gate does not count" above. |
| Defect | A 3 px edge with G above max(R, B) by 6 stayed opaque. The bright-green fringe row did not see it. |
| Root cause | The key gate counted bright key green only. |
| Fix | `tools/assetcheck` `check_alpha` fails when more than 1% of that 3 px band leans green, for key `alpha` or `green`. `python3 tools/assetcheck/despill.py` clamps G to max(R, B) and erodes alpha 1 px into a different file. A `lock/` path stays WARN. |
| Guard | `python3 tools/assetcheck/selftest.py` `edge_green_despill` (red on the fringe, green after despill). Limit 0.01. |
| Sources | Take 10d chroma entry above. Tool version `db693e5`. The ship stills are not stored in this repo. |

### 2026-10-02 — orbit preflight gates luma and elevation before eight views

| | |
| --- | --- |
| Take | Tooling follow-up to take 10d. Cites "orbit views drift in camera height and exposure" above. |
| Defect | Eight views drifted in elevation and luma. `tools/objsheet` gated area and height only. |
| Root cause | No per-view check against the hero still. |
| Fix | `python3 tools/objsheet/preflight.py` grades luma (±10%), hue correlation (≥ 0.80), centered silhouette IoU (≥ 0.55), top fraction (±25% of the hero), and ground gap (0.12). A fail recommends 3–4 views on a limited arc and a stop after 2 of the same defect. Elevation is a silhouette proxy, not a surveyed camera. |
| Guard | `python3 tools/objsheet/selftest.py` `preflight_views`. A bright copy of the hero fails luma. A near copy passes. |
| Sources | Take 10d orbit entry above. Tool version `db693e5`. The view stills are not stored in this repo. |

### 2026-10-02 — a short sky loop reads as the same flash

| | |
| --- | --- |
| Take | Tooling follow-up. Owner refinement on the living sky: the loop must not feel repetitive. |
| Defect | One short loop, shared by every slice, makes a distinctive event (a flash, a shooting star) return on a fixed period. |
| Root cause | A single duration and a single start time. The backdrop gate did not measure a period. |
| Fix | Three Imagine layers at about 13 s, 17 s, and 29 s. Combined repeat is their least common multiple (6409 s). The gate fails a combined repeat under 600 s. Each slice gets its own start offset (adjacent offsets at least 0.75 s apart). Motion stays slow (frame MAE ≤ 8). A rare bright feature on a fixed period under 60 s fails. A rare event is a separate one-shot clip with a random gap of at least 30 s. |
| Guard | `python3 tools/sky/selftest.py` (flash period 1 s fails; a gentle drift and an always-on star field pass; 10/20/30 s fails the 600 s floor). `python3 tools/sky/check.py` prints `combinedRepeatSec`. |
| Sources | Owner refinement on the living-sky requirement. No still of the repetitive loop is stored. |

### 2026-10-02 — step size and the two-failure stop are written down

| | |
| --- | --- |
| Take | Tooling follow-up to take 10d. Cites "one oversize step per headless session, ending without a final answer" above. |
| Defect | Attempts of 419 and 290 turns ended with no final answer. The same orbit drift was cooked a third time. |
| Root cause | The step held many art families, and the stop was "after 3 rounds". |
| Fix | [`spec.md`](../spec.md) and `AGENTS.md`: one goal, a done-when list of at most 8 rows, `REPORT.md` written as the rows are measured, stop after 2 failures of the same defect. Hall smoke stays one fresh cook plus one enlarge. |
| Guard | The spec text. There is still no check that a run ended with a final answer. |
| Sources | Take 10d oversize entry above. |

### 2026-10-02 — law 23 does not measure a level horizon, slice closure, f_px, or texel density

| | |
| --- | --- |
| Take | Geometry lock. No cook. |
| Defect | A level plate (horizon at half the frame) and a pitched Frost cone (diamond near 0.38) were easy to mix. The dash judge does not read horizon row, slice count, focal length in pixels, or pixels per metre. |
| Root cause | Law 23 walks neon dashes toward 0.38 and does not fail fitted VP.y against 0.382. Nothing else in that script measured the rail 12 numbers. |
| Fix | Rail 12 in `spec.md` and [`learn/geometry.md`](geometry.md). Reports on the same script: `--report horizon`, `sky`, `turn`, `sun`, `texel`, `scale`. They are not the hang gate. The dash thresholds stay sealed. |
| Guard | `python3 biome/scripts/plate-geo-qc/selftest.py` |
| Sources | Owner geometry lock, 2026-10-02. Practice, not an xAI seal. |
