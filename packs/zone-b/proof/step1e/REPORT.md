Built: the three near buttes are one sunk loft, and the ringed planet keeps its place while its bands turn inside the still. IN TEST. Not a lock.

Verdict: IN TEST

Checked: root `npm test` exit 0. `tools/playcheck` npm test 43 pass / 0 fail. Sky `check.py` 59 failures (slice files unchanged). Live playcheck exit 1, 24 pass / 7 fail, on `clearing/1` (table below). Imagine requests 9, budget 8, files shipped 8. Presented mag 0.993, planet mag 0.94, planet worldW 98.19 m, worldH 45.41 m, drawCalls 6, texture bytes 210102402 (200.4 MiB), activeVideos 2, WebGL errors 0. heroCount 1 on chase, eye-level, and sky. heroCount 0 on wide and mesa-close.

Known issues: nothing is painted above about 30.5°. Skirt lift stays 28 m. Wide 8-row luma jump +8.4 at row 256, the same haze as step 1d. On heading 255 the low painted mesa tops sit under the skirt. The loft corner where two Imagine faces meet is a visible seam. Butte-0's back and the tops of butte-0 and butte-2 are not true orthographic views. The planet clip's first and last frames differ by a small amount. `solids_world_locked` identical pairs are 6 (step 1d was 5). Layout is still `clearing/1`. Micro cutouts are still none. One pass. Those Imagine misses stay.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Chase and eye-level show the planet, rings, both moons, the sun, and the near butte on the horizon. Heading 90 shows the painted mesa row. Mesa-close shows two faces and a cap, with the base in the ground. Top 80 rows: chase −0.3, eye-level −0.3, sky +0.4, wide −2.4. Wide jump +8.4 at row 256. | FAIL |
| Ground | Walk `heightAt` unchanged. Skirt lift 28 m, fog mix 0.18, fog 260–470 m, alpha 300–460 m. Loft sink 1.8 m under `seatMin`. Butte-0 baseY −0.57, seat 1.23. `details` still `[]`. | FAIL |
| Sky | `check.py` 59 failures, same count as step 1d. Slice files unchanged. Planet card heading 259°, elevation 13.5°, 380 m, mag 0.94. Video colours a feathered disk. The still keeps the silhouette, rings, and moons. Card alpha 0.004, blend off. | FAIL |
| Magnification | Presented 0.993. Planet 0.94. Butte mag: chase 0.317, sky 0.392, mesa-close 0.623, wide 0.898. | PASS |
| Perf | drawCalls 6, texMB 200.4 (210102402 bytes), videoDecoders 2, WebGL errors 0. HUD off in the proof shots. | PASS |
| playcheck | Unit tests 43/43. Live circle walk on `clearing/1`: see the table. `mag_max` 0.993. `solids_world_locked` objects=5, pairs=91, identical=6. | FAIL |
| Gates | npm test exit 0. playcheck npm test 43 pass. sky check 59 failures. Live playcheck exit 1. Bolt sha256 `38fb40ce81ba8326fd6a8c88ad3ddf21fc16496769b477066d804b8cb8454b0e` matches `lock/bolt-gallop-cycle.mp4`. `git diff` on `lock/` and `packs/zone-a` empty. Imagine requests 9 / budget 8. | FAIL |
| Docs | sky.md Part 3, ground.md Part 2b, decisions-log 2026-10-04, self-improvement zone B rows, METHOD.md zone B row. All IN TEST. | PASS |
| Proof | Five JPEGs in this folder and in `/workspace/grokcli/out/zoneB/step1e/`, each 720×1600. | PASS |

Imagine: 7 `image_edit` stills plus two `reference_to_video` requests. The 2:1 request was rejected before a file. The 16:9 clip is `packs/zone-b/src/sky/planet.mp4` (848×480). Fronts `butte-0.jpg`, `butte-1.jpg`, `butte-2.jpg` were reused. Provenance (untracked): `/workspace/grokcli/out/zoneB/step1e/run/provenance.json`.

Shots (720×1600 JPEG, canvas `toDataURL`, HUD off):

- `chase.jpg` — gallop, heading 255, pitch −3.89°, heroCount 1, mag 0.993. Eye [5.29, 2.39, −13.65]. Largest 8-row jump −10.8 at row 568. Bytes 153494.
- `eye-level.jpg` — idle, heading 255, pitch −3.89°, heroCount 1. Eye [5.29, 2.37, −13.65]. Largest jump −10.8 at row 568. Bytes 153749.
- `sky.jpg` — idle, heading 90, pitch −2.75°, heroCount 1. Eye [−8.87, 2.23, −15.52]. Largest jump +12.6 at row 608. Bytes 140451.
- `wide.jpg` — `lookAt([-40,18,-24],[6,1,14])`, pitch −15.90°, heroCount 0. Largest jump +8.4 at row 256. Bytes 134213.
- `mesa-close.jpg` — butte-0, eye [−31.03, 4.60, −47.44], pitch +1.57°, idle, heroCount 0, butte mag 0.623. Bytes 131512.

Loft (`mesas.js`, one draw): butte-0 worldH 12.31, width 5.16, depth 4.49, side/back/top real. butte-1 worldH 7.04, width 8.30, depth 7.11, back falls back to the front. butte-2 worldH 10.45, width 7.64, depth 4.89, back falls back to the front. Texture array 1120×1280, 10 layers, uploadError 0, 654 tris.

Run: `python3 -m http.server 8991 --bind 127.0.0.1` from this worktree. Play URL: `http://127.0.0.1:8991/packs/zone-b/play/index.html`. Sky gate: `python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json --out /tmp/zb-skycheck-1e` (59 failures). Root `npm test` exit 0.

Live playcheck (`node tools/playcheck/run --url http://127.0.0.1:8991/packs/zone-b/play/index.html --layout packs/zone-b/clearing.json --no-video`, out `tools/playcheck/out/2026-10-04T15-26-34-525Z`, gitignored): exit 1. Result FAIL, 24 pass / 7 fail. Same seven row names as step 1d. `mag_max` 0.993 at 01-spawn. drawCalls 6. textureBytes 210102402. activeVideos 2.

| row | result | numbers |
|---|---|---|
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.993, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.993, at=01-spawn, limit=1, missing=0 |
| fix_hint | PASS | reportOnly |
| stops_visible | FAIL | stops=8, invisible=8 |
| collider_eq_visual | FAIL | tolerance_m=0.5, stops=8, bad=8 |
| solids_world_locked | FAIL | objects=5, pairs=91, identical=6 |
| layout_rendered | PASS | objects=0 |
| ring_closed | FAIL | dataHits=0, dataMissCount=360, renderMiss=36 |
| gate | FAIL | layout has no gate |
| near_lens | PASS | nearest_m=80 |
| fog_band | FAIL | patches=0, fogPixels=0 |
| black_regions | PASS | hitCount=0 |
| tile_repeat | PASS | worstPeak=0.861 |
| backdrop_res | PASS | mag=0.99, sourceH=720 |
| single_hero | PASS | heroCount=1, frames=128 |
| single_bolt | PASS | |
| idle_gallop_switch | PASS | |
| fullscreen | PASS | 720×1600 |
| debug_hook | PASS | |
| fps_avg | PASS | informational, software GL |
| fps_1low | PASS | informational, software GL |
| frame_ms | PASS | informational, software GL |
| js_heap | PASS | heap not reported |
| texture_mem | PASS | 210102402 bytes |
| video_decoders | PASS | 2 |
| active_videos | PASS | 2 |
| draw_calls | PASS | 6 |
| perf_line | PASS | texMB=200.369 |
| render_source | FAIL | scanned=false (this command does not pass `--source`) |
