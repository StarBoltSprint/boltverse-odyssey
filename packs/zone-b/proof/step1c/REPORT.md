Built: Ember Mesa upper sky is nine 1280×620 slices (azimuth 40°, elevation 12.0° to 30.5°, presented mag 0.993). The far skirt rises 42 m by 480 m, mixes 0.40 toward the one horizon fog colour, then fades out over the sky between 300 m and 460 m. IN TEST. Not a lock.

Verdict: IN TEST

Checked: root `npm test` exit 0. `tools/playcheck` npm test 43 pass / 0 fail. Sky `check.py` 59 failures. Sky selftest PASS. Live playcheck exit 1, 24 pass / 7 fail, on `clearing/1` (table below). Imagine calls 4 new, budget 4. Five step-1b stills reused. Presented mag 0.993, drawCalls 7, texture bytes 140712898 (134.2 MiB), activeVideos 1, WebGL errors 0, heroCount 1 on chase, eye-level, and sky.

Known issues: nothing is painted above about 30.5°. Chase and eye-level still show a far rim (8-row luma jump −14.3 at row 543 on chase, −15.1 at row 519 on eye-level). Sky joins, motif, and exposure still fail. One new frame kept only its sky crop (desert floor discarded). Two small crescents sit in `upper/sky-7.jpg`. The wide camera does not see Bolt (heroCount 0), same pose as step 1b. Layout is still `clearing/1`. Micro cutouts are still none. Prompts were not stored.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Zenith band gone. Step 1b chase jump +40.9 at row 119 is −0.3 in the top 80 rows. Wide jump +33.7 at row 352 is now +3.3 at row 197; mid-frame (rows 400–800) is −0.8. Chase rim remains (−14.3 at row 543). No solid top band. No slice rectangles in the four shots. | FAIL |
| Ground | Walk `heightAt` unchanged (span and slope not remeasured). Skirt lift 42 m, fog mix 0.40, alpha 300–460 m. Wide pose meets the mesas in haze. Chase far edge remains. One tile period still reads. `details` still `[]`. | FAIL |
| Sky | `check.py` 59 failures. Horizon joins, motif, exposure swing 69, combined repeat 10.0 s, plus motif on `upper/sky-0.jpg` through `upper/sky-8.jpg`. Selftest PASS. Hole above 30.5°. | FAIL |
| Magnification | Presented 0.993 on the four proof poses (upper). Horizon 0.990. Ground on chase 0.824. Wide butte 0.898. Cap slot 0.010 (not shown). | PASS |
| Perf | drawCalls 7, texMB 134.2 (140712898 bytes), videoDecoders 1, WebGL errors 0. HUD off in the proof shots. | PASS |
| playcheck | Unit tests 43/43. Live circle walk on `clearing/1`: see the table. `mag_max` from the proof hook is 0.993. | FAIL |
| Gates | npm test exit 0. playcheck npm test 43 pass. sky selftest PASS. sky check 59 failures. Live playcheck exit 1. Bolt sha256 `38fb40ce81ba8326fd6a8c88ad3ddf21fc16496769b477066d804b8cb8454b0e` matches `lock/bolt-gallop-cycle.mp4`. `git diff` on `lock/` and `packs/zone-a` empty. Imagine 4/4. | FAIL |
| Docs | sky.md Part 3, ground.md Part 2b, decisions-log 2026-10-04, self-improvement zone B rows. All IN TEST. | PASS |
| Proof | Four JPEGs in this folder and in `/workspace/grokcli/out/zoneB/step1c/`, each 720×1600. | PASS |

Imagine: 4 new `image_gen` calls at 16:9 (1280×720). Calls 1–3 installed after dropping the top 100 px (`upper/sky-7.jpg`, `upper/sky-3.jpg`, `upper/sky-0.jpg`). Call 4 was not installed whole (desert floor); rows 0–620 are `upper/sky-5.jpg`. Reused, no new call: step 1b `n01`–`n05`. Order around the ring: g2, n04, n05, g3, n03, g4, n02, g1, n01. Provenance (untracked): `/workspace/grokcli/out/zoneB/step1c/run/provenance.json`.

Shots (720×1600 JPEG, canvas `toDataURL`, HUD off):

- `chase.jpg` — gallop, heading 255, pitch −2.71°, heroCount 1, mag 0.993. Eye [−6.05, 2.26, −16.69].
- `eye-level.jpg` — idle, heading 255, pitch −3.74°, heroCount 1. Eye [10.95, 2.45, −12.14].
- `sky.jpg` — idle, heading 90, pitch −2.02°, heroCount 1. Eye [−3.2, 2.23, −14].
- `wide.jpg` — `lookAt([-40,18,-24],[6,1,14])`, pitch −15.90°, heroCount 0, butte mag 0.898.

Luma (Rec.709, sample every 2 px, 8-row means) against `/workspace/grokcli/out/zoneB/step1b/`:

| shot | step 1b largest jump | step 1c |
|---|---|---|
| chase | +40.9 at row 119 | top 80 rows −0.3; rim −14.3 at row 543 |
| eye-level | +40.7 at row 113 | top 80 rows −0.4; rim −15.1 at row 519; foreground −18.6 at row 1559 |
| wide | +33.7 at row 352 | +3.3 at row 197 |
| sky | +23.8 at row 729 | +8.2 at row 1226 (ground). Mid-frame −4.5 at row 478 |

Run: `python3 -m http.server 8983 --bind 127.0.0.1` from this worktree. Play URL: `http://127.0.0.1:8983/packs/zone-b/play/index.html`. Sky gate: `python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json --out /tmp/zb-skycheck`.

Live playcheck (`node tools/playcheck/run --url http://127.0.0.1:8983/packs/zone-b/play/index.html --layout packs/zone-b/clearing.json --no-video`, out `tools/playcheck/out/2026-10-04T11-40-06-324Z`, gitignored): exit 1. Result FAIL, 24 pass / 7 fail. Same seven rows as step 1b. `mag_max` 0.993 at 01-spawn. drawCalls 7. textureBytes 140712898.

| row | result | numbers |
|---|---|---|
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.993, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.993, at=01-spawn, limit=1, missing=0 |
| fix_hint | PASS | reportOnly |
| stops_visible | FAIL | stops=8, invisible=8, blocked=false, no label |
| collider_eq_visual | FAIL | tolerance_m=0.5, stops=8, bad=8, surface=edge_ring |
| solids_world_locked | FAIL | objects=4, pairs=87, identical=5 |
| layout_rendered | PASS | objects=0 |
| ring_closed | FAIL | dataHits=0, dataMissCount=360, renderMiss=36 |
| gate | FAIL | layout has no gate |
| near_lens | PASS | nearest_m=80 |
| fog_band | FAIL | patches=0, fogPixels=0 |
| black_regions | PASS | hitCount=0 |
| tile_repeat | PASS | worstPeak=0.861 |
| backdrop_res | PASS | mag=0.99, sourceH=720 |
| single_hero | PASS | heroCount=1, blobs=1 |
| single_bolt | PASS | |
| idle_gallop_switch | PASS | |
| fullscreen | PASS | 720×1600 |
| debug_hook | PASS | |
| fps_avg | PASS | informational, software GL |
| fps_1low | PASS | informational, software GL |
| frame_ms | PASS | informational, software GL |
| js_heap | PASS | heap not reported |
| texture_mem | PASS | 140712898 bytes |
| video_decoders | PASS | 1 |
| active_videos | PASS | 1 |
| draw_calls | PASS | 7 |
| perf_line | PASS | |
| render_source | FAIL | scanned=false (this command does not pass `--source`) |

Preview freeze: `python3 tools/preview/freeze.py --zone zone-b --commit f184f93 --report packs/zone-b/proof/step1c/REPORT.md --play-dir packs/zone-b/play --out previews` exited 1. The tool said `REPORT verdict is missing; freeze waits for PASS`. This file says `Verdict: IN TEST`. No preview folder was written.
