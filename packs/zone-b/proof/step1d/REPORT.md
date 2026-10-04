Built: Ember Mesa chase and eye-level show the ringed planet, both moons, the golden-hour sun, and the 16 m butte. Heading 90 shows the painted mesa row through light fog. IN TEST. Not a lock.

Verdict: IN TEST

Checked: root `npm test` exit 0. `tools/playcheck` npm test 43 pass / 0 fail. Sky `check.py` 59 failures (slice files unchanged). Sky selftest PASS. Live playcheck exit 1, 24 pass / 7 fail, on `clearing/1` (table below). Imagine calls 1 new, budget 4. The planet image is a keyed crop of the existing horizon slice. Presented mag 0.993, planet mag 0.94, drawCalls 8, texture bytes 141312386 (134.8 MiB), activeVideos 1, WebGL errors 0, heroCount 1 on chase, eye-level, and sky.

Known issues: nothing is painted above about 30.5°. On heading 255 the low painted mesa tops sit under the 28 m skirt; the butte is the skyline in chase and eye-level. The wide join is haze (8-row luma jump +8.4 at row 256). Sky joins, motif, and exposure still fail. The wide camera does not see Bolt (heroCount 0), same pose as step 1b. Layout is still `clearing/1`. Micro cutouts are still none. The planet cutout keeps a hard edge. One pass. That edge is accepted.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Planet, rings, and both moons are in chase and eye-level, with the sun and one butte. Heading 90 shows the painted mesa row. Top 80 rows: chase \|d\| 0.2, eye-level 0.3, sky 0.7, wide 2.4. No solid zenith band. Wide jump +8.4 at row 256. Sun-heading painted mesa tops sit under the skirt. | FAIL |
| Ground | Walk `heightAt` unchanged (span and slope not remeasured). Skirt lift 28 m, fog mix 0.18, fog 260–470 m, alpha 300–460 m, discard under alpha 0.02. Post fog density 0.0035, cap 0.16. One tile period still reads. `details` still `[]`. | FAIL |
| Sky | `check.py` 59 failures, same rows as step 1c. Selftest PASS. Hole above 30.5°. Planet card heading 259°, elevation 13.5°, 380 m, mag 0.94. | FAIL |
| Magnification | Presented 0.993 on the four proof poses. Planet 0.94. Horizon 0.990. Ground on chase 0.824. | PASS |
| Perf | drawCalls 8, texMB 134.8 (141312386 bytes), videoDecoders 1, WebGL errors 0. HUD off in the proof shots. | PASS |
| playcheck | Unit tests 43/43. Live circle walk on `clearing/1`: see the table. `mag_max` from the proof hook is 0.993. `solids_world_locked` objects=5 (the planet card is the fifth label); identical pairs stay 5. | FAIL |
| Gates | npm test exit 0. playcheck npm test 43 pass. sky selftest PASS. sky check 59 failures. Live playcheck exit 1. Bolt sha256 `38fb40ce81ba8326fd6a8c88ad3ddf21fc16496769b477066d804b8cb8454b0e` matches `lock/bolt-gallop-cycle.mp4`. `git diff` on `lock/` and `packs/zone-a` empty. Imagine 1/4. | FAIL |
| Docs | sky.md Part 3, ground.md Part 2b, decisions-log 2026-10-04, self-improvement zone B rows, METHOD.md zone B row. All IN TEST. | PASS |
| Proof | Four JPEGs in this folder and in `/workspace/grokcli/out/zoneB/step1d/`, each 720×1600. | PASS |

Imagine: 1 new `image_edit` at 16:9 (1280×720). Keyed and cropped to `packs/zone-b/src/sky/planet.png` (493×228). Reused, no new call: horizon slice 2, the early ringed-planet frame. Provenance (untracked): `/workspace/grokcli/out/zoneB/step1d/run/provenance.json`.

Shots (720×1600 JPEG, canvas `toDataURL`, HUD off):

- `chase.jpg` — gallop, heading 255, pitch −2.71°, heroCount 1, mag 0.993. Eye [−6.05, 2.26, −16.69]. Largest 8-row jump −8.8 at row 1560.
- `eye-level.jpg` — idle, heading 255, pitch −3.74°, heroCount 1. Eye [10.95, 2.45, −12.14]. Largest jump −18.4 at row 1560.
- `sky.jpg` — idle, heading 90, pitch −2.02°, heroCount 1. Eye [−3.2, 2.23, −14]. Largest jump +8.7 at row 632.
- `wide.jpg` — `lookAt([-40,18,-24],[6,1,14])`, pitch −15.90°, heroCount 0. Largest jump +8.4 at row 256.

Run: `python3 -m http.server 8986 --bind 127.0.0.1` from this worktree. Play URL: `http://127.0.0.1:8986/packs/zone-b/play/index.html`. Sky gate: `python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json --out /tmp/zb-skycheck-1d`.

Live playcheck (`node tools/playcheck/run --url http://127.0.0.1:8986/packs/zone-b/play/index.html --layout packs/zone-b/clearing.json --no-video`, out `tools/playcheck/out/2026-10-04T12-35-34-853Z`, gitignored): exit 1. Result FAIL, 24 pass / 7 fail. Same seven rows as step 1c. `mag_max` 0.993 at 01-spawn. drawCalls 8. textureBytes 141312386.

| row | result | numbers |
|---|---|---|
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.993, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.993, at=01-spawn, limit=1, missing=0 |
| fix_hint | PASS | reportOnly |
| stops_visible | FAIL | stops=8, invisible=8 |
| collider_eq_visual | FAIL | tolerance_m=0.5, stops=8, bad=8 |
| solids_world_locked | FAIL | objects=5, pairs=93, identical=5 |
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
| texture_mem | PASS | 141312386 bytes |
| video_decoders | PASS | 1 |
| active_videos | PASS | 1 |
| draw_calls | PASS | 8 |
| perf_line | PASS | texMB=134.766 |
| render_source | FAIL | scanned=false (this command does not pass `--source`) |

Preview freeze: `python3 tools/preview/freeze.py --zone zone-b --commit bd60e60 --report packs/zone-b/proof/step1d/REPORT.md --play-dir packs/zone-b/play --out previews` exited 1. The tool said `REPORT verdict is missing; freeze waits for PASS`. This file says `Verdict: IN TEST`. No preview folder was written.
