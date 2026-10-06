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
| Fix | Read `learn/taste.md` before a visual step. The Golden rule is first: a living painted film, Imagine pixels, Bolt's Imagine-video gallop, the owner's decrees. Style rules: sharp edges, distinctive silhouettes, no circles, etched angular dark-violet weathered marks, large organic biomes, one ship across an orbit set. Append the owner's reaction after the review. |
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

### 2026-10-02 — single-image mesh leaves the phone orbit with holes

| | |
| --- | --- |
| Take | Ship real-3D proof. No new Imagine cook. |
| Defect | The phone orbit of the crashed ship shows holes through the hull. Mean coverage of the above-ground surface is 0.703. The minimum is 0.618 at yaw 90 and yaw 180. |
| Root cause | TripoSR saw one still (`yaw-000`) and invented the other sides. After yaw/scale alignment the silhouette IoU against the four cardinal plates is 0.445. The build accepts that mesh at 0.15, so a shape that does not sit in the plates is drawn, and every texel those plates miss stays transparent. View drift between the plates is a separate, already logged miss (orbit views). |
| Fix | The shown frames keep the transparent holes. The four-view visual hull on the same cameras scored silhouette IoU 0.543 and remains the fallback when the network mesh will not line up. No second network resolution. |
| Guard | `tools/mesh3d/out/qc/report.json` fields `coverageMin`, `coverageMean`, and `triposr.alignIoU`. `python3 tools/mesh3d/selftest.py` checks the synthetic box, the blend, and magnification ≤ 1. Nothing fails the ship build for a low align IoU or for holes. |
| Sources | `learn/take-notes/2026-10-02-ship-real3d.md`. Frames `tools/mesh3d/out/frames/yaw-090.png`. |

### 2026-10-03 — a wide camera still reads the ground tile period

| | |
| --- | --- |
| Take | Zone A step 1. Ground and relief. |
| Defect | From a high or far camera the 1.45 m still repeats. Family changes follow a height test, so a lip can show a hard contour. |
| Root cause | Eight stills cannot cover 6500 m2 without a period. A code blend mask is not allowed, and no transition still was cooked. |
| Fix | Left as a known issue. The tile was not enlarged again: walk ground mag was already 0.912. |
| Guard | No row fails a wide view for period. The phone mag check only caps magnification. |
| Sources | `packs/zone-a/proof/step1/01-overview.png`, `02-wide.png`. |

### 2026-10-03 — page.screenshot hangs on the play canvas

| | |
| --- | --- |
| Take | Zone A step 1. Proof capture. |
| Defect | `page.screenshot` timed out at 30 s and at 60 s after fonts loaded. The canvas itself was fine. |
| Root cause | On this host the SwiftShader compositor does not finish a screenshot of the WebGL canvas. |
| Fix | Proof PNGs came from `canvas.toDataURL` (`preserveDrawingBuffer` is on). |
| Guard | No playcheck row. Filed `feedback/2026-10-03-playcheck.md`. |
| Sources | `packs/zone-a/proof/step1/02-wide.png`. |

### 2026-10-03 — one ground edit returned HTTP 429

| | |
| --- | --- |
| Take | Zone A step 1. Eighth ground slot. |
| Defect | Materials 6 and 7 are the same bytes. The second slot is not a new still. |
| Root cause | The edit of session `2.jpg` failed with HTTP 429 resource-exhausted. It was not retried. |
| Fix | Copied the saved still into both slots. Stopped. One failed attempt, not two. |
| Guard | No row compares the eight slot hashes. |
| Sources | `packs/zone-a/src/ground/m6.png` and `m7.png` share one sha256. |

### 2026-10-03 — depth prep treated the mask name as a tile

| | |
| --- | --- |
| Take | Zone A step 1. `packs/zone-a/src/terrain/prep.py`. |
| Defect | A run wrote `hask.png` beside the depth maps. |
| Root cause | `mask.png` starts with `m`, and the depth branch used `startswith("m")` plus a replace of the first `m`. |
| Fix | Depth runs only when the second character is a digit (`m0.png`). `hask.png` is not in the tree. |
| Guard | No test calls `prep.py`. The branch is the guard. |
| Sources | `packs/zone-a/src/terrain/prep.py`. |
### 2026-10-03 — walkaround and mesh3d still sampled nearest, and auto called TripoSR

| | |
| --- | --- |
| Take | Tool loop for issue #153. No Imagine cook. |
| Defect | Play viewers in `tools/walkaround` and `tools/mesh3d` sampled world stills with nearest / no mipmaps. `tools/mesh3d --engine auto` could replace the play mesh with TripoSR. |
| Root cause | Law 65 and the golden rule were written into the docs on 2026-10-03. The tool code and the selftests were not updated, so a green selftest could still ship nearest sampling and a network mesh. |
| Fix | Play stills use `LINEAR_MIPMAP_LINEAR` and mipmaps. CPU QC nearest is labelled a measurement buffer. `auto` is the visual hull. TripoSR runs only with `--experiment triposr` and is not written into the play mesh. The checked-in `out/asset.json` stays the 2026-10-02 experiment record with `feedsPlay` false. Magnification limit stays 1.0. |
| Guard | `python3 tools/walkaround/selftest.py` (`check_law65_play_sampling`) and `python3 tools/mesh3d/selftest.py` (`check_law65_and_triposr`). `node tools/playcheck/src/renderlint.mjs` on `tools/walkaround/web/view.html`, `tools/walkaround/runtime/hullmesh.js`, and `tools/mesh3d/viewer/main.js`. |
| Sources | Issue #153. [`docs/METHOD/decisions-log.md`](../docs/METHOD/decisions-log.md) contradictions 7 and 8. [`biome/docs/65-render-quality.md`](../biome/docs/65-render-quality.md). |

### 2026-10-03 — slow sky dissolve fails the frozen loop row

| | |
| --- | --- |
| Take | Zone A step 2. Stars, dust, nebula. |
| Defect | The Imagine clips looped in content and still failed `check_loop`. |
| Root cause | A slow dissolve keeps consecutive frame MAE under 0.45 for longer than 0.40 s. A crossfade of those frames stays frozen. |
| Fix | Keep existing frames whose gray MAE sits in [0.45, 16), then ping-pong so the last kept index equals the first. |
| Guard | `python3 tools/sky/check.py` loop row. `check_loop` FROZEN_MAE 0.45 and FROZEN_SEC 0.40. |
| Sources | `packs/zone-a/src/sky/stars.mp4`, `dust.mp4`, `nebula.mp4`. |

### 2026-10-03 — straight-up view collapses, then the pole still notches

| | |
| --- | --- |
| Take | Zone A step 2. Look-up proof. |
| Defect | A look straight up first filled the frame with one fogged colour. After the camera basis was fixed, the same view showed faint radial lines and one small notch at the pole. |
| Root cause | `applyShot` built a zero right vector when the view was exactly up, so the view matrix collapsed and the clear colour was fogged. The dome pole is a lat-long pinch. Two zenith projections (polar, then gnomonic) left the notch. |
| Fix | When the horizontal right vector is shorter than 1e-4, pick a world axis. Stopped after the second projection. The notch is listed in `packs/zone-a/proof/step2/REPORT.md`. |
| Guard | No playcheck row reads a straight-up frame. The proof PNG is `packs/zone-a/proof/step2/lookup.png`. |
| Sources | `packs/zone-a/play/play.js` `applyShot` and the sky dome. |

### 2026-10-03 — a centre splice and a heavy tile mix both passed the old sky edge gate

| | |
| --- | --- |
| Take | Zone A step 2b. Living sky. |
| Defect | Joined slices showed a hard vertical seam in the middle while join MAE on the outer columns was 0. A first play view also drew a grid of video rectangles over the paintings. |
| Root cause | Equalising slice width by cutting the middle and concatenating the sides. Eight stamped edge columns satisfy the join strip and hide a cloud mismatch. Additive tiles at a high gain draw their quad edges. |
| Fix | Crop spare width from the outer edges only. Keep video tiles, and drop the additive gain until the paintings stay sharp. Magnification of those tiles is now a hard fail in `tools/sky/check.py` and `tools/playcheck`. |
| Guard | `python3 tools/sky/check.py` display rows. Old 848×480 over 360° fails (mag about 13.5). The step 2b tiles pass at 0.792. The edge MAE still does not see a content mismatch at heading 0; that one is listed in the step 2b report. |
| Sources | `docs/METHOD/sky.md`, `packs/zone-a/play/play.js`, `tools/sky/pixels.py`. | |

### 2026-10-03 — horizon outpaint repeated the source, then stopped

| | |
| --- | --- |
| Take | Zone A step 2c. Failed slices only. |
| Defect | Two Imagine edits meant to continue a kept horizon edge. The first repeated the source motif and added a ground silhouette. The second was a hard diptych and still showed a ground silhouette. Neither continued the neighbour edge. |
| Root cause | The edit treated the supplied strip as a picture to place beside a new painting, instead of growing that strip. |
| Fix | Stopped after the second try. The step-2b slices stay in the ring. The motif gate now fails those files. |
| Guard | `python3 tools/sky/check.py` motif rows. Horizon 0–4 and 7 fail repeat. Upper 6 still passes (soft gap). |
| Sources | `tools/sky/pixels.py`, `packs/zone-a/proof/step2/REPORT.md`. Untracked provenance: `/workspace/grokcli/out/zoneA-step2c/provenance.json`. |

### 2026-10-03 — dark rock pixels fail the walkaround hole gate

| | |
| --- | --- |
| Take | Zone A step 3. Stone hull. |
| Defect | All eight stone views failed interior holes at 0.024 to 0.074. The plates were not missing pixels. |
| Root cause | `foreground_mask` drops a pixel when its max channel is at or under the 0.04 background threshold. Opaque basalt with max channel ≤ 10 counts as a hole. Alpha holes on the same plates were 0. |
| Fix | The rock carve config sets `bgThreshold` to -1, so the silhouette follows alpha. The walkaround default is unchanged. Do not flood-fill the dark pixels. |
| Guard | `tools/walkaround` hole row, limit 0.002, on the raw mask. A negative `bgThreshold` in the rock config is what lets this set pass. No selftest feeds an opaque black subject. Filed `feedback/2026-10-03-walkaround-dark-hole.md`. |
| Sources | `tools/walkaround/hull.py` foreground mask. `tools/rocks/build.py` writes the config. |

### 2026-10-03 — a short dense orbit view cannot be height-matched by scaling down

| | |
| --- | --- |
| Take | Zone A step 3. Crest hull. Not shipped. |
| Defect | Yaw 90 was about 15% shorter than its neighbours and also the densest plate. Yaw 270 was the same kind of miss. Keep min was 0.7085, which passes 0.70. The height lock failed. |
| Root cause | Shrinking the tall plates to the short height drops pixel area past the 0.15 lock. Enlarging the short plate is forbidden. |
| Fix | Two cooks, then stop. The crest slots stay in the manifest and play skips them when no hull is present. Boulders are the sky-line solids in this pass. |
| Guard | `python3 tools/objsheet/sheet.py` adjacent height ±8% and area ±15%. The crest set fails height. No row detects "short and denser" before the scale attempt. |
| Sources | `docs/METHOD/rocks.md` pitfalls. Views stay outside the repo. |

### 2026-10-04 — micro-details at the texel budget still read as flecks from the chase boom

| | |
| --- | --- |
| Take | Zone A step 5. DetailGenerator. Shipped IN TEST. Eye-level row FAIL. |
| Defect | 700 keyed cards, heights 0.08–0.18 m, sit on the drawn relief and show at eye height. From the chase boom (about 7 m, eye about 1.9 m) the same cards are flecks. The plate carpet remains the read. One pebble sheet kept a joined mirror, so that stone sits proud. |
| Root cause | Screen height at 7 m is about 40 px for a 0.16 m card. Dark cards on dark plates disappear. The mirror is opaque to the bottom of the crop, so seating the crop bottom lifts the real stone. |
| Fix | Stop after two cooks. Do not enlarge the stills. Heights already sit on the texel budget (`texelsPerM` 1800, scale ≤ 1). |
| Guard | No automatic row. `packs/zone-a/proof/step5/REPORT.md` row 2 is the check. `python3 tools/details/selftest.py` checks density and height, not the chase read. |
| Sources | `docs/METHOD/details.md` known issues. Prompts stay in the local file. |

### 2026-10-04 — detail cards seated on `heightAt` sank under the drawn ground

| | |
| --- | --- |
| Take | Zone A step 5 follow-up (code only, no Imagine call). |
| Defect | Cards seated on the minimum of `heightAt` samples. The median card sank 13% of its height; 66 of 700 sank more than half and 20 were fully hidden. Part of the "flecks" read in the chase. |
| Root cause | `heightAt` carries micro relief (up to about ±0.12 m) between ground mesh vertices (about 0.36 m apart). The mesh draws straight triangles between vertices, not that relief. |
| Fix | `terrain.meshHeightAt` returns the drawn triangle height. Details seat on its lowest point under each plane's bottom edge. After: 0 cards more than half buried, 0 floating. |
| Guard | None automatic. Any layer that seats small things must seat on `meshHeightAt`, not `heightAt`. |
| Sources | `docs/METHOD/details.md` §5. |

### 2026-10-03 — a walk opening that meets the frame is not an enclosed hole

| | |
| --- | --- |
| Take | Zone A step 4. Eclipse Gate loft. |
| Defect | The first hole finder kept only a small enclosed crack. The arch the player walks toward was missing, so the loft filled the gateway. |
| Root cause | The opening meets the bottom border. A flood from the corner treats that dark span as outside, not as a hole. |
| Fix | The gate loft takes the dark span between the first and last stone of each row, unions enclosed voids of at least 800 px, and keeps the tallest component as the opening. |
| Guard | `python3 tools/ruins/selftest.py --kit howling-eclipse` requires `openingClear` and a non-empty hole box. |
| Sources | `tools/ruins/gate.py`, `packs/zone-a/src/ruins/measure.json`. |

### 2026-10-04 — eclipse mark landed above the lintel

| | |
| --- | --- |
| Take | Zone A step 4b. Eclipse Gate redo. |
| Defect | The eclipse mark is painted on the empty part of the elevation above the lintel. The opening the player gallops through is a plain rectangle. |
| Root cause | The first plate split the lintel and drew two discs. The repair plate joined the slabs and moved the mark onto the crest, still outside the void. |
| Fix | Two cooks, then stop. The mark stays paint on the elevation. It is not a second volume, so it was not inpainted off the skin. |
| Guard | `packs/zone-a/proof/step4b/REPORT.md` row 1. A later cook has to show the mark inside the opening on the play frame, not only on the plate. |
| Sources | `tools/ruins/inbox/howling-eclipse/front.jpg`, `packs/zone-a/src/ruins/measure.json` ring-motif. Prompts stay in the untracked step 4b note. |

### 2026-10-04 — a flat ruin seat floats the downhill foot

| | |
| --- | --- |
| Take | Zone A step 4c. Owner phone, 2026-10-04 11:58. |
| Defect | The monolith's base hovered. The downhill foot sat about 1.37 m above the drawn relief, and the horizon showed under the slab. |
| Root cause | The seat is one `heightAt` sample minus sink. The mesh bottom is flat. Dropping the whole gate to the lowest foot would bury the opening in the crest. |
| Fix | `appendSkirts` in `packs/zone-a/play/ruins.js` hangs only the lowest ring down to `heightAt` minus sink. Those faces stay out of the collider. The gate foot repeats the surface plate at its native density. Other skins shift into stone already in the island. |
| Guard | No playcheck row reads the framebuffer gap. `info().seats` reports `skirts` and `footGap`. Proof `packs/zone-a/proof/step4c/03-gate-base.jpg` (gate footGap 1.371, 106 quads). A one-off solid colour on the foot branch filled that band; the shipped pixels there are the plate. |
| Sources | `packs/zone-a/play/ruins.js`. Owner still `42183a078c155ab3daf45b26214fa637050a97c22d0d8676ba43f0e36e32f44e.jpg`. |

### 2026-10-04 — wreck faces that sample the plate's black read as a void

| | |
| --- | --- |
| Take | Zone A step 4c. Owner phone, 2026-10-04 11:58. |
| Defect | The hangar interior and a slab beside the opening were black. |
| Root cause | Inward walls took UVs from the port hole and the empty margin. The plating itself was already grey where the UVs hit the silhouette. |
| Fix | `retile_black` in `tools/ruins/wreck.py` duplicates those triangles onto a mid-tone window of the same skin, at that skin's texel rate. No new texture. Eight centroids remain on dark specks inside the chosen windows (port 1, starboard 7). Stopped. |
| Guard | `python3 tools/ruins/build.py --kit howling-eclipse` prints `wreck retile`. No row fails a walkable frame for a black blob. Proof `packs/zone-a/proof/step4c/01-wreck-outside.jpg` and `02-hangar-inside.jpg`. |
| Sources | `tools/ruins/wreck.py`, `packs/zone-a/src/ruins/measure.json`, `packs/zone-a/src/ruins/wreck/wreck.ruin`. Owner still `7872ae48d5a83b3d17de8c44687c1f29d8115546ee23a0416c71068c6c8136a7.jpg`. |

### 2026-10-04 — decree brief ranker misses the numbered post

| | |
| --- | --- |
| Take | Living Archives / Echo Shards. Branch `archives-shards`. |
| Defect | The keyword brief’s top five were decrees 625, 643, 704, 697, and 629. Decrees #351 and #352, the posts this step is built on, were absent. |
| Root cause | The ranker scores shared words. Long Citadel posts outscore a short decree when the spec is full of kit words (bolt, gate, hall). |
| Fix | The brief keeps the ranker list and appends the owner-named posts from the local jsonl, labeled as ranker misses. Quotes were copied. Nothing was invented. |
| Guard | `packs/common/archives/decree-brief.md` section “Owner-named decrees” cites post `2071264181135827220` (#351, 2026-06-28T16:07:17Z) and post `2071268834363736574` (#352, 2026-06-28T16:25:47Z). No test fails a brief that omits the numbered decree. |
| Sources | `tools/decrees/brief.py`. `packs/common/archives/decree-brief.md`. |

### 2026-10-04 — a pickup card over the chase subject reads as a world crystal

| | |
| --- | --- |
| Take | Living Archives / Echo Shards. Branch `archives-shards`. |
| Defect | The first card sat just above the joystick, on Bolt’s legs. The lore read, and the crystal image looked like another shard in the world. |
| Root cause | `cardBox` anchored the card to the stick’s top edge. On the portrait chase that band is the dog and the near ground. |
| Fix | The card sits in the upper left, under no paw reserve and clear of the stick. The image is the Imagine crystal. The line under it is HTML text. |
| Guard | `node --test packs/common/archives/archives.test.mjs` row “paw stays off the stick and inside the reserved corner” asserts the card does not overlap the stick or the paw reserve and that `card.y + card.h < vh * 0.4` at 360×800 and 720×1600. |
| Sources | `packs/common/archives/layout.js`. Stills `shard-world.png`, `pickup-card.png` under `/workspace/grokcli/out/archives/` (not committed). |

### 2026-10-04 — a 720p menu video cannot cover a 720×1600 phone

| | |
| --- | --- |
| Take | Archives polish. Branch `archives-shards`. Owner 2026-10-04 20:36. |
| Defect | The hall film does not reach the top and bottom of a 720×1600 phone. |
| Root cause | Imagine video rejected aspect `9:20` and resolution `1080p` before writing a file. The accepted call, 720p at `9:16`, is 720×1280. Covering 720×1600 would be magnification 1.25. |
| Fix | Place the 720×1280 film at scale 1. Hide the world canvas while a menu is open. The gap is a matte sampled once from the still’s four corners. Do not scale, stretch, or smear the frame. |
| Guard | `node --test packs/common/archives/archives.test.mjs` row “menu film covers a 9:16 phone and never enlarges on a tall one”: 720×1280, 360×800 at device pixel ratio 2 is contain, scale 1, `enlarged` false. Seam row: first-to-last MAE 1.8, which is under 8. |
| Sources | `packs/common/archives/art/hall-loop.mp4`. `packs/common/archives/backdrop.js`. Phone shot `/workspace/grokcli/out/archives/polish/menu-pause.png`. |

### 2026-10-04 — a 640×1424 menu film still cannot cover 720×1600

| | |
| --- | --- |
| Take | Archives futuristic hall. Branch `archives-shards`. Owner 2026-10-04 21:54. |
| Defect | The shared menu film leaves a matte gap on a 720×1600 phone. Cover would be magnification 1.125. |
| Root cause | The session video tool rejected aspect `9:20` and resolution `1080p` before writing a file. The accepted call is 640×1424. Two image edits that asked for a taller plate returned 576×1280. The tool schema lists `9:20` and `9:19.5`; the API allow-list does not. Doc 64 still says 1080p is legal for one-image image-to-video. This session’s tool accepts only `480p` and `720p`. |
| Fix | Place the 640×1424 film at scale 1. The gap is the corner matte. Do not scale, stretch, smear, or spend another call on the same height miss. Close an open Imagine clip with ping-pong when the tool cannot pin the last frame. The source seam was MAE 14.445. The shipped ping-pong seam is MAE 1.813. |
| Guard | `node --test packs/common/archives/archives.test.mjs` row “menu film never enlarges on a 720x1600 phone”: 640×1424, cover 1.125, contain, scale 1, CSS 320×712. Seam row: first-to-last MAE 1.813, which is under 8, and the 3 s frame is farther from frame 0 than the seam. The 720×1280 entry above names a test title this step replaced. That older entry stays as the record of the gothic film. |
| Sources | `packs/common/archives/art/hall-loop.mp4`. `packs/common/archives/backdrop.js`. Phone shot `/workspace/grokcli/out/archives/futurist/pause.png`. Tool note `feedback/2026-10-04-imagine-video-aspect.md`. |
### 2026-10-04 — the framebuffer foot gap had no failing row

| | |
| --- | --- |
| Take | tools-learn 2026-10-04. The earlier foot entry on this date stays. Its guard said no row reads the gap. |
| Defect | A ruin foot floated about 1.37 m above downhill relief. The data `footGap` is the skirt drop, so a closed skirt can still leave a visible hole, and a data number never looked at the picture. |
| Root cause | Playcheck and the proof scanner had no column walk from the ground up through sky pixels to a solid. |
| Fix | `foot_contact` in `tools/frames` and `tools/playcheck` fails when enough columns show that gap. `seat_foot_gap` stays INFO. |
| Guard | `python3 tools/frames/selftest.py` (float fails, a seated foot passes, open sky under a far solid passes). `node --test tools/playcheck/src/frames.test.mjs`. |
| Sources | `tools/frames/pixels.py`, `tools/playcheck/src/frames.mjs`. Proof `packs/zone-a/proof/step4c/03-gate-base.jpg` now passes the pixel row. |

### 2026-10-04 — a large black or untextured face had no failing row

| | |
| --- | --- |
| Take | tools-learn 2026-10-04. The earlier black-face entry on this date stays. Its guard said no row fails a black blob. |
| Defect | Wreck hull and interior faces rendered pure black after an enlarge. `black_regions` only flags a filled near-black rectangle. |
| Root cause | A jagged or mid-grey flat face is not that rectangle, so the walk stayed green. |
| Fix | `untextured` fails a large black or flat region that is not a full-width night band touching the top. `black_regions` is unchanged. |
| Guard | `python3 tools/frames/selftest.py` (jagged black fails, a night band passes, a flat grey fails). `node --test tools/playcheck/src/frames.test.mjs`. |
| Sources | `tools/frames/pixels.py`, `tools/playcheck/src/frames.mjs`. |

### 2026-10-04 — sky seams, a zenith band, and a hard ground line had no frame row

| | |
| --- | --- |
| Take | tools-learn 2026-10-04. Zone B step 1b, any biome. |
| Defect | The sky showed slice rectangles, overlapping translucent panels, a vertical streak, and a flat dark band at the zenith. The ground ended in a hard horizontal line and a void band under the mesas. |
| Root cause | `tools/sky/check.py` grades the slice files. It does not read the proof framebuffer. Nothing read the ground horizon in the shot. |
| Fix | `sky_frame` and `ground_frame` in `tools/frames`. The validated sky recipe stays. This gate is extra and IN TEST. |
| Guard | `python3 tools/frames/selftest.py` (zenith, slice, panels, streak, hard line, void fail; a busy top and cracked ground pass). |
| Sources | `tools/frames/pixels.py`. Zone B stills stay outside this repo. |

### 2026-10-04 — a required hero was absent from the proof shots

| | |
| --- | --- |
| Take | tools-learn 2026-10-04. Zone B step 1b. |
| Defect | The brief asked for a ringed planet over the mesas. The shots had none, and the report still closed. |
| Root cause | No step compared the brief's hero list to a box in the proof frames. |
| Fix | `## Must show` or `## Heroes` must map through `shows.json` to a crop that is not flat or empty. No such heading is n/a. |
| Guard | `python3 tools/frames/selftest.py` (a missing planet fails; an empty brief is n/a). |
| Sources | `tools/frames/heroes.py`. |

### 2026-10-04 — a detail collider blocked a hard-object walk passage

| | |
| --- | --- |
| Take | tools-learn 2026-10-04. Merging details onto the new gate. |
| Defect | A rock disc sat in a walk opening. The hangar and a camera-shake case had already been broken by the same kind of merge. |
| Root cause | Placement generators did not know the gate opening or the hangar mouth. Nothing ran playcheck on the merged tree before the branch landed. |
| Fix | `tools/rocks/place.mjs` and `tools/layout/scatter.py` skip those quads. `node tools/playcheck/src/premerge.mjs` audits the discs and runs the unit tests. The committed rocks manifest is not rewritten by that audit. |
| Guard | `node tools/rocks/place.mjs --selftest` (a covering passage places nothing; kit counts stay). `python3 tools/layout/passages.py`. `node --test tools/playcheck/src/passages.test.mjs`. |
| Sources | `tools/rocks/passages.mjs`, `tools/layout/passages.py`, `tools/playcheck/src/premerge.mjs`. |

### 2026-10-04 — magnification above 1 and a stair crown were one number

| | |
| --- | --- |
| Take | tools-learn 2026-10-04. |
| Defect | Close hull and monolith faces sat above magnification 1, and a monolith crown was stair-stepped. `fix_hint` named only the worst hit and stayed PASS. |
| Root cause | The report did not list every hotspot with the three fixes, and no pixel row counted long flat steps on a silhouette. |
| Fix | `mag_hotspots` fails when the best density at that distance is still above 1 and names the farther camera, the smaller scale, and a recook. Do not enlarge the current texture. `stair_crown` names a finer loft, a smoother silhouette, or that recook. `fix_hint` stays PASS. |
| Guard | `python3 tools/frames/selftest.py` (close hull mag and the three phrases; a stair fails and a 1 px diagonal passes). `node --test tools/playcheck/src/frames.test.mjs`. |
| Sources | `tools/frames/pixels.py`, `tools/playcheck/src/frames.mjs`, `tools/playcheck/src/checks.mjs`. |

### 2026-10-04 — a long check died without a resume point

| | |
| --- | --- |
| Take | tools-learn 2026-10-04. |
| Defect | A long proof scan or a pre-merge check stopped mid-run. The next session could not see what was done. |
| Root cause | The tools wrote the report only at the end, and the step notes did not list a remaining list. |
| Fix | `tools/frames/check.py` and `tools/playcheck/src/premerge.mjs` write progress and accept `--resume`. The report lists Done and Left. Commit each accepted slice. Do not commit `__pycache__` or `.smoke`. |
| Guard | `tools/frames/README.md` and the pre-merge section of `tools/playcheck/README.md`. A resumed scan skips ids already in the progress file. |
| Sources | `tools/frames/resume.py`, `tools/frames/check.py`, `tools/playcheck/src/premerge.mjs`. |

### 2026-10-05 — flat cards for world solids, and crude boxes up close

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. No new cook. |
| Defect | Canyon walls, mesas, rocks, shards, and details were planned as flat cards, billboards, sprites, or far impostors. A good near rock was also swapped for a stepped box. |
| Root cause | Older rows still named crossed cards, 8-view impostor far LOD, and "impostors only as far LOD". |
| Fix | Standing rules 1 and 8 in `docs/METHOD.md`. Far LOD is a cheaper solid. Near and mid stay the frigate loft. Only the sky is a backdrop. |
| Guard | No new machine row. `stair_crown` in `python3 tools/frames/check.py` still fails a stair-stepped crown. A card that is not that row is caught by the standing rule and [`docs/METHOD/rejected.md`](../docs/METHOD/rejected.md). |
| Sources | [`docs/METHOD.md`](../docs/METHOD.md), [`docs/METHOD/hard-objects.md`](../docs/METHOD/hard-objects.md). |

### 2026-10-05 — one video laid on a full still sky

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. No new cook. |
| Defect | An animated nebula, cloud, meteor, or planet was one video composited on an already-full still sky. It read as a moving screen on a picture. |
| Root cause | The locked sky v1 paints full slices and then adds living layers. That stack was copied forward as the only sky cook. |
| Fix | Standing rule 2. Next sky cooks start nearly empty (gradient + distant stars). Each animated element is its own looping Imagine video. Zone A sky v1 stays locked until a later version scores better. |
| Guard | No new machine row. `python3 tools/sky/check.py` still gates the locked v1 slices. The cook rule is [`docs/METHOD/sky.md`](../docs/METHOD/sky.md). |
| Sources | [`docs/METHOD.md`](../docs/METHOD.md) standing rule 2. |

### 2026-10-05 — a planet clip that does not fill the frame or does not turn

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. No new cook. |
| Defect | A planet was drawn, small in the frame, or called rotating without a frame-by-frame check. Display then upscaled it. |
| Root cause | The prompt asked for a planet. The frames were not scrubbed. |
| Fix | Standing rule 3. Highest resolution, planet filling almost the whole frame, photorealistic. Confirm rotation on the frames before claiming it works. |
| Guard | No new machine row. The check is a frame scrub, written in [`docs/METHOD/sky.md`](../docs/METHOD/sky.md). |
| Sources | [`docs/METHOD.md`](../docs/METHOD.md) standing rule 3. |

### 2026-10-05 — an invisible wall in front of a real opening

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. Confirms the 2026-10-04 face-collider row. |
| Defect | Bolt stopped on a keep-out box while the Gate arch and the wreck hangar were open in the picture. |
| Root cause | Colliders were a circle or a hand-placed box, not the drawn faces. |
| Fix | Standing rule 4. Colliders follow the faces. Walk under the arch. Enter the hangar. |
| Guard | `tools/playcheck/src/ruinwalk.test.mjs`. Recipe [`docs/METHOD/ruins.md`](../docs/METHOD/ruins.md) §7. |
| Sources | [`docs/METHOD.md`](../docs/METHOD.md) standing rule 4. The 2026-10-04 decisions-log row. |

### 2026-10-05 — a gothic menu, or a second Archives module

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. Confirms the 2026-10-04 21:54 hall and the 18:29 shared module. |
| Defect | A menu used a stone door or a gothic hall. A zone built its own Echo Shards module instead of a manifest. |
| Root cause | The old plate was still in the art folder. The shared-module rule was easy to miss below the element table. |
| Fix | Standing rules 5 and 6. High-tech Citadel (dark metal, glass, cyan/violet holograms). One module. Manifest only. Local progress first. |
| Guard | `node --test packs/common/archives/archives.test.mjs` (no `plate.jpg` on pause). A forked module has no extra row; the standing rule is the guard. |
| Sources | [`docs/METHOD/archives.md`](../docs/METHOD/archives.md), [`learn/recipes/archives-futurist-hall.md`](recipes/archives-futurist-hall.md). |

### 2026-10-05 — a phone kept a module that had no cache bust

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. No new cook. |
| Defect | A grok.me play page looked unchanged for hours after a publish. The root host 307s to the play path, and a module or video without `?v=` stayed cached. |
| Root cause | The short share URL and the cache bust were not in the cold-start sheet. |
| Fix | Standing rule 7. Prefer `https://<slug>.grok.me/` when that redirect exists. Bump `?v=` after a replace, or validate in a private tab, before calling the build broken. |
| Guard | No machine row. [`FAIL.md`](../FAIL.md) matrix row for a module or video with no `?v=`. |
| Sources | [`docs/METHOD.md`](../docs/METHOD.md) standing rule 7. |

### 2026-10-05 — player debug text, and a phone over the owner caps

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. Confirms the 2026-10-04 debug-text row and the ≤ 12 / ≤ 260 targets. |
| Defect | Position, mode, take card, or GL errors stayed on the player view. A play view was treated as fine at drawCalls 150 because that is the tool ceiling. |
| Root cause | Law 65 required the perf line and ≤ 4 videos. It did not state drawCalls ≤ 12, texMB ≤ 260, or the debug-text hide. |
| Fix | Standing rule 9. drawCalls ≤ 12, texMB ≤ 260, videos ≤ 4 including Bolt. Debug text only with `?debug=1`. |
| Guard | Law 65 `active_videos` still fails a fifth decode. No playcheck row fails drawCalls above 12 yet (`drawCallsMax` 150). The owner cap is [`biome/docs/65-render-quality.md`](../biome/docs/65-render-quality.md). |
| Sources | [`docs/METHOD.md`](../docs/METHOD.md) standing rule 9. |

### 2026-10-05 — another cook spent on view drift or specks

| | |
| --- | --- |
| Take | Owner lessons hung 2026-10-05. Cites "a sky or hull video that drifts inside the frame" (2026-09-29). |
| Defect | View drift and specks were cooked again after they were already known Imagine defects. |
| Root cause | The stop-after-2 rule did not name those two defects, so a new session treated them as fresh bugs. |
| Fix | Standing rule 10. Accept view drift and specks. Do not burn quota on them. Stop after 2 still applies to any other repeated defect. |
| Guard | No new machine row. Workflow §2 in [`docs/METHOD.md`](../docs/METHOD.md). |
| Sources | [`docs/METHOD.md`](../docs/METHOD.md) standing rule 10. |

### 2026-10-06 — sky array upload passed ten arguments

| | |
| --- | --- |
| Take | Corridor look, sky, and props. |
| Defect | The play page died on boot with `texSubImage3D: 11 arguments required, but only 10 present`. The frame was a 6 KB blank. |
| Root cause | `texSubImage3D` for a pixel buffer needs x, y, and z offsets, then width, height, and depth. The sky upload omitted the z offset. |
| Fix | Pass `0, 0, 0, layer` before the size. Ground tiles upload the same way, from pixels, not from an image element. |
| Guard | A settled `?shot=hdg` title is JSON with `glError` 0. An `ERR` title is not a proof. |
| Sources | `packs/corridor-ab/play/sky.js` |

### 2026-10-06 — the stream pool filled from behind the camera

| | |
| --- | --- |
| Take | Corridor chase, sprint, and streaming props. |
| Defect | A max-sprint shot showed the same rocks as a walk. The pool was full, and none of those rocks sat inside the portrait cone. |
| Root cause | Fill walked cells from behind Bolt and across the wide lanes first. The 36 slots were gone before a forward centre rock was seated. The first lanes were also just outside `tan(11.35°)`. |
| Fix | Seat monuments, then forward centre lanes (`|lateral| < 6`), then other forward lanes, then behind. The inner lanes start at ±2.15 m so a rock ahead of Bolt is inside the 22.7° cone. |
| Guard | `node --test packs/corridor-ab/play/stream.test.mjs` — "a faster pace streams more rocks than a walk" requires more rocks and more of them inside the cone. |
| Sources | `packs/corridor-ab/play/stream.js` |

### 2026-10-06 — the paw quad used the image fraction from the top

| | |
| --- | --- |
| Take | Corridor chase, sprint, and streaming props. |
| Defect | Bolt's feet floated about 1.8 m above the ground at `pawFrac` 0.92. |
| Root cause | The quad offset added `frac * worldH`. Zone A stores the lowest opaque row from the top of the frame. With `UNPACK_FLIP_Y` the paw is at texture `v = 1 - pawFrac`, so the rise from the quad bottom is `(1 - frac) * worldH`. |
| Fix | `pawLine` and the Bolt quad both use `(1 - frac) * worldH`. The measured paw sits on y = 0. |
| Guard | `node --test packs/corridor-ab/play/look.test.mjs` — "the paw row sits on the ground". |
| Sources | `packs/corridor-ab/play/look.js`, `packs/zone-a/play/play.js` |

### 2026-10-06 — the chase aimed at the paws

| | |
| --- | --- |
| Take | Corridor horizon and one ground. |
| Defect | On a 720×1600 phone the frame was almost all floor. The arch was cut off at the top. The sky dome was not in the picture. |
| Root cause | The aim height was 0.62 m while the eye was 3.5 m, so the pitch was about −25°. The horizon sat above the frame. |
| Fix | Aim at 2.52 m. The pitch is about −9°. On the 22.7° portrait the horizon lands near 32% from the top. Bolt's body stays in the lower third. |
| Guard | `node --test packs/corridor-ab/play/look.test.mjs` — "the chase stays high and the horizon sits in the top third". |
| Sources | `packs/corridor-ab/play/look.js` |

### 2026-10-06 — ground stills drew a square every tile

| | |
| --- | --- |
| Take | Corridor horizon and one ground. |
| Defect | The floor read as a checkerboard. Neighbouring 1.45 m squares were different stills, and a single still with a dark rim drew the same square again. |
| Root cause | Each cell picked a layer from the WFC set. m0 and m1 are darker at the rim than in the core (about 9 and 10 luma), so a quad per cell lines those rims up. |
| Fix | One quad covers the carpet. It repeats `m3.png` at native 1024². m3's rim matches its core (about 1 luma). Four windows of that same still crossfade, so a rim cannot line up into a grid. |
| Guard | No machine row measures the screen grid. The play title records `ground` `m3`, `groundLayers` 1, `groundPx` 1024. The proof crops are the check. |
| Sources | `packs/corridor-ab/play/play.js`, `packs/zone-a/src/ground/m3.png` |

### 2026-10-06 — the ground met the sky in a straight line

| | |
| --- | --- |
| Take | Corridor horizon break, seated rocks, whole monolith. |
| Defect | The carpet ended in a ruler where it met the sky. |
| Root cause | A flat quad vanishes in a straight line in this lens. Rocks about 1.3 m tall stay below an eye at 3.5 m, so they never cross that line. No test required a tall solid inside the forward view. |
| Fix | Eight existing boulder and stone hulls, scaled to at least 8 m, sit on the horizon inside the 22.7° cone and clear of the run. Ground fog uses a colour sampled from the sky slices, density 0.015, cap 0.58. Bolt's draw is not fogged. |
| Guard | `node --test packs/corridor-ab/play/stream.test.mjs` — "horizon seats are tall, in the forward view, and clear of the run". |
| Sources | `packs/corridor-ab/play/stream.js`, `packs/corridor-ab/play/play.js` |

### 2026-10-06 — a settled rock sat on the plane and the rise showed a gap

| | |
| --- | --- |
| Take | Corridor horizon break, seated rocks, whole monolith. |
| Defect | Streamed rocks read as floating, including while they rose into place. |
| Root cause | The lowest vertex was placed at y = 0 when emerge finished, and the rise added a positive gap on the way up. No test required the base to stay under the plane. |
| Fix | `rockBottom` is −0.18 m when settled and lower while emerging, so the rise starts underground. |
| Guard | `node --test packs/corridor-ab/play/stream.test.mjs` — "a rock bottom stays under the plane through the rise". |
| Sources | `packs/corridor-ab/play/stream.js`, `packs/corridor-ab/play/play.js` |

### 2026-10-06 — the 28 m gate was cut off, and a far offset left the lens

| | |
| --- | --- |
| Take | Corridor horizon break, seated rocks, whole monolith. |
| Defect | The monolith was cut at the top when Bolt came close. Moving it 55 m off the run hid it: the 22.7° lens never held it. |
| Root cause | On the run line the top needs a pitch the chase is not allowed to take. At 55 m of lateral the bearing is outside the lens for the whole approach. The sprint look of about 55 m also dropped the gate before it was inside the cone. No test measured the gate's screen position. |
| Fix | The gate sits 16 m off the run, alternating sides. A sprint looks out to 150 m so the gate is drawn while it is still in the lens. Pitch may rise by at most 0.22 rad above the rest chase, and never goes below the current pitch. |
| Guard | `node --test packs/corridor-ab/play/look.test.mjs` — "a tall monolith raises the pitch and a far one does not". `node --test packs/corridor-ab/play/stream.test.mjs` — "a sprint sees the gate while it is still inside the forward view". |
| Sources | `packs/corridor-ab/play/look.js`, `packs/corridor-ab/play/stream.js`, `packs/corridor-ab/play/play.js` |

### 2026-10-06 — the pass shot started west of the carpet

| | |
| --- | --- |
| Take | Corridor ground covers the pass start. |
| Defect | For the first two thirds of `monolith-pass.mp4`, the ground near Bolt (from about 40% of the frame down) was pure black. The textured floor filled in toward the camera as Bolt ran east. Walk was fine. |
| Root cause | The carpet west edge was `xStart − 40` (`xmin` −40.6). The pass Bolt starts at −63.275, with the camera 6.1 m further west, so the near ground was past the quad and the clear colour showed. Fog and the m3 crossfade were not the hole. No test placed the carpet behind the pass camera. |
| Fix | `carpetWest` is the further west of the walk apron and the pass Bolt minus 40 m. The west edge is −103.275. One quad, same texture, same draw. |
| Guard | `node --test packs/corridor-ab/play/stream.test.mjs` — "the carpet covers the ground under the pass camera". No pixel row measures every 6th frame. The proof clip is that check. |
| Sources | `packs/corridor-ab/play/stream.js`, `packs/corridor-ab/play/play.js` |

### 2026-10-06 — echo positions clamped into a monument

| | |
| --- | --- |
| Take | Adventure contract v0. |
| Defect | Some seeds wrote Echo Shard positions inside the 3.5 m monument clearance. `validateCard` then failed those cards. |
| Root cause | A nudge away from a monument was clamped back toward the gate seat at `0.9 * length`. |
| Fix | `placeShards` picks a slot grid: 0.4 m steps, 3.6 m from each monument seat, 2.6 m between shards. A short span returns fewer shards than asked. |
| Guard | `node --test tools/adventure/adventure.test.mjs` — offline cards for the sample seeds pass `validateCard`, which rejects a position within 3.5 m of a monument. |
| Sources | `tools/adventure/offline.js`, `tools/adventure/validate.js` |

### 2026-10-06 — ruin magnification floored the eye at 5 cm inside the box

| | |
| --- | --- |
| Take | Corridor magnification sweep. |
| Defect | The first table reported wreck magnification 512 and arch magnification 230. |
| Root cause | Distance was `Math.max(0.05, dist)` and an eye inside the ruin AABB was given dist 0. The face was the roof or a pier, about 0.6 m away, and a doorway is empty. |
| Fix | `ruinFaceDist` uses the surface outside the box, the opening edges inside a doorway, and the nearest face inside a solid. Non-finite magnification is dropped. |
| Guard | `node --test packs/corridor-ab/play/chase.test.mjs` — headings 82 and 127 stay at or under 1, and the gate row at 16.6 m stays finite and under 1. |
| Sources | `packs/corridor-ab/play/mag.js`, `packs/corridor-ab/proof/smooth/before.json` |

### 2026-10-06 — the gate elevation stayed up until magnification 3

| | |
| --- | --- |
| Take | Corridor magnification sweep. |
| Defect | At 16.6 m the gate elevation read magnification 2.95 while a closer plate already existed. |
| Root cause | The plate blend waited until magnification passed about 3 (`CLOSE_LO` 2.5, switch 3). The elevation is 36.6 texels per metre. The plate is 183. |
| Fix | The blend starts at 0.92 and is fully on the plate at 1.0. `GATE_CLOSE_SWITCH` is 1. Zone A draws the same shader. |
| Guard | `node --test packs/corridor-ab/play/chase.test.mjs` — "the gate plate takes over at magnification 1" and "the old gate elevation row is on the plate and under the limit". |
| Sources | `packs/zone-a/play/ruins.js`, `packs/corridor-ab/proof/smooth/before.json` |

### 2026-10-06 — a world-space chase ease collapsed the boom on a turn

| | |
| --- | --- |
| Take | Corridor chase smoothness. |
| Defect | During a 150°/s joystick turn the camera boom fell to 2.21 m. The position step still looked legal because the allow bound included a full orbit. |
| Root cause | The spring eased the whole eye in world space, so Bolt’s turn was mixed with the cone offset and the eye lagged inside the boom. |
| Fix | The rigid parent (chase eye of the body) is followed every frame up to one kinematic step. Only a larger shove and the cone offset ease, at 3.4 m/s. Pitch steps ease at 0.85 rad/s. |
| Guard | `node --test packs/corridor-ab/play/chase.test.mjs` — "scripted run: camera deltas stay inside the continuous bound" (`minBoomWhileStraight` > 5.5, spikes 0). |
| Sources | `packs/corridor-ab/play/look.js`, `packs/corridor-ab/proof/smooth/camera-trace.json` |

### 2026-10-06 — the sky draw referenced a yaw that the chase move had hidden

| | |
| --- | --- |
| Take | Corridor proof stills. |
| Defect | The play page set the title to `ERR Uncaught ReferenceError: yaw is not defined` and never drew. |
| Root cause | `placeCamera` kept `yaw` local and `frame` still passed that name into `sky.draw`. |
| Fix | `placeCamera` returns `yaw` and the sky draw uses `cam.yaw`. |
| Guard | `node --test packs/corridor-ab/play/chase.test.mjs` — the sampler test matches `sky.draw(vp, eyeBuf, cam.yaw)`. |
| Sources | `packs/corridor-ab/play/play.js` |

### 2026-10-06 — proof sprint aimed at the monument seat

| | |
| --- | --- |
| Take | Living Codex truths. |
| Defect | The proof runner that sprints with `?shot=adventure` collected the Echo Shards and then never reached the goal. One 80-frame step stopped returning. |
| Root cause | Shards sit about 1.6 m off the path. Steering all the way to a wreck or gate seat walks into the hull. The pass radius is 5 m, so the path itself is already close enough. A center-line sprint also misses a required set once the feet drift. |
| Fix | `?collect=1` eases toward the next shard only while it is within 6 m, then returns to the path. It does not run for a normal play URL. |
| Guard | No unit row measures the ease. The proof is `packs/corridor-ab/proof/codex/REPORT.md`: seeds 1024, 68, and 351 passed, and the three truths survived a reload. |
| Sources | `packs/corridor-ab/play/play.js` |
