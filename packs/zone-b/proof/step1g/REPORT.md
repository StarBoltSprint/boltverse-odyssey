Built: canyon walls and a mesa skyline, relief-picked ground materials, lane-side cutouts and fallen blocks, one haze loop, and a replaced planet loop. IN TEST. Not a lock.

Verdict: IN TEST

Checked: root `npm test` exit 0. `tools/playcheck` npm test 43 pass / 0 fail. Live playcheck exit 1, 25 pass / 6 fail, on `clearing/1` (table below). `render_source` passed because this run passed `--source`. Sky `check.py` was not re-run; the step 1f count of 84 failures still stands. Phone 720×1600: presented mag 0.982, planet mag 0.5, drawCalls 8, texture bytes 216551234 (206.5 MiB), active videos 3, WebGL errors 0 on the live walk. heroCount 1.

Imagine calls: 9 images, 3 videos. Budget was 14 and 3. The third video replaced the planet loop after a dark band opened in the first planet file. Pack `packs/zone-b` 31,614,117 bytes (30.1 MiB), under 150 MB. Step 1f pack was 26,494,762 bytes.

Walkable area: 6,500 m². Length 143.73 m. Width at z = 60, 40, 20, 0, −20, −40, −60: 47.5, 44.5, 40.5, 41.5, 44.0, 47.5, 47.0 m. Loop: plaza, slot, basin, wash, outpost, mesa road, return to plaza. The outline was not converted to a circle.

Known issues: the upper gradient, repeated nine times, can show a vertical join, and nothing is painted above 28.88°. The wide pose still shows the ground tile lattice. The loft base still meets the ground on a straight cut. One moon keeps a thin key fringe. `contain()` stops on the outline. Live playcheck on `clearing/1` is the circle schema. Those six rows stay open. Those misses stay.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Chase, slot, basin, and planet-close are 720×1600, HUD off, one planet, videos decoding on those four. Wide is the elevated pose with videos decoding. Planet-close pitch 4.00°, sky time 4.24 s, planet video ready. | PASS |
| Ground | Area 6500 m². Length 143.73 m. Width 40.5–47.5 m. Boot maxSlope 0.2366 rad (13.56°). Skirt lift 3.5 m. The wide pose still shows the tile lattice. | FAIL |
| Sky | `check.py` not re-run (step 1f: 84 failures). Haze is four cards, mag 0.75, gain 0.28. Planet heading 180°, elevation 15°, 380 m, mag 0.5, world 135.60×76.28 m, video on. A thin fringe remains on one moon. | FAIL |
| Magnification | Presented 0.982 on chase, wide, slot, basin, planet-close. Planet 0.5. Ground on chase 0.777. Butte on chase 0.656. | PASS |
| Perf | drawCalls 8, texMB 206.5 (216551234 bytes), activeVideos 3, WebGL errors 0 on the live walk. HUD off in the proof shots. | PASS |
| playcheck | Unit tests 43/43. Live circle walk on `clearing/1`: see the table. `mag_max` 0.982. `solids_world_locked` objects=39, pairs=257, identical=1. | FAIL |
| Gates | npm test exit 0. playcheck npm test 43 pass. Sky check not re-run. Live playcheck exit 1. | FAIL |
| Docs | sky.md Part 3, ground.md Part 2b, rocks.md Part 3, decisions-log 2026-10-04 step 1g, self-improvement zone B rows, METHOD.md zone B row and the 18:58 sky row. All IN TEST. | PASS |
| Proof | Layer JPEGs, five final JPEGs at 720×1600, and `map.png` in this folder and in `/workspace/grokcli/out/zoneB/step1g/`. | PASS |

Shots (720×1600 JPEG, canvas `toDataURL`, HUD off), recaptured on the shipped planet loop:

- `chase.jpg` — gallop 12 ticks from spawn, heading 180, pitch −4.85°, mag 0.982. Eye about [0, 1.62, 60.44]. Ground mag 0.777. Butte mag 0.656. Planet video ready. drawCalls 8, texture bytes 216551234, videos 3.
- `wide.jpg` — `lookAt([-36,16,-20],[33,3.4,38])`, pitch −7.96°, mag 0.982. Ground mag 0.068. Butte mag 0.597. Planet video ready. Videos 3.
- `slot.jpg` — place (0, 22), heading 180, pitch −4.83°, mag 0.982. Ground mag 0.823. Butte mag 0.499. Eye about [0, 1.23, 29.2]. Planet video ready.
- `basin.jpg` — place (2, −10), heading 180, pitch −3.03°, mag 0.982. Ground mag 0.825. Butte mag 0.502. Eye about [2.00, 0.76, −2.80]. Planet video ready. Haze time 3.18 s.
- `planet-close.jpg` — pitch 4.00°, mag 0.982. Eye z 62.2. Planet video ready. Haze time 4.24 s. Same file as `layer5-planet.jpg`.
- `map.png` — top-down loop.

Layer proofs, committed with each layer: `layer1-chase.jpg`, `layer2-chase.jpg`, `layer3-details.jpg`, `layer4-haze.jpg`, `layer5-planet.jpg`.

Boot `groundInfo` on the chase: tris 57774, verts 30442, area 6500, minH −3.144, maxH 8.745, maxSlope 0.2366 rad. Mesa: count 39, layers 8, tex 1280×1280, tris 8502, uploadError 0, sink 2.6 m.

Run: `python3 -m http.server 8766 --bind 127.0.0.1` from this worktree. Play URL: `http://127.0.0.1:8766/packs/zone-b/play/index.html`. Root `npm test` exit 0. `cd tools/playcheck && npm test` 43 pass / 0 fail.

Live playcheck (`node tools/playcheck/run --url http://127.0.0.1:8766/packs/zone-b/play/index.html --layout packs/zone-b/clearing.json --no-video --source packs/zone-b/play/play.js`, out `tools/playcheck/out/2026-10-04T20-10-05-715Z`, gitignored): exit 1. Result FAIL, 25 pass / 6 fail. The layout was not converted to `clearing/2`. The tool appended `?debug=1` on its own URL. The proof JPEGs were shot without that query, and the HUD was `none`.

| row | result | numbers |
|---|---|---|
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.982, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.982, at=01-spawn, limit=1, missing=0 |
| fix_hint | PASS | reportOnly |
| stops_visible | FAIL | stops=8, invisible=8 |
| collider_eq_visual | FAIL | tolerance_m=0.5, stops=8, bad=8 |
| solids_world_locked | FAIL | objects=39, pairs=257, identical=1 |
| layout_rendered | PASS | objects=0 |
| ring_closed | FAIL | dataHits=0, dataMissCount=360, renderHeadings=36, renderMiss=36 |
| gate | FAIL | empty detail |
| near_lens | PASS | nearest_m=80 |
| fog_band | FAIL | patches=0, fogPixels=0 |
| black_regions | PASS | hitCount=0 |
| tile_repeat | PASS | worstPeak=0.946, worstLag=4, worstAt=03-gate-start |
| backdrop_res | PASS | mag=0.991, sourceH=720 |
| single_hero | PASS | heroCount=1, frames=128 |
| single_bolt | PASS | |
| idle_gallop_switch | PASS | |
| fullscreen | PASS | 720×1600 |
| debug_hook | PASS | |
| fps_avg | PASS | informational, software GL, fpsAvg=10.66 |
| fps_1low | PASS | informational, software GL |
| frame_ms | PASS | informational, software GL |
| js_heap | PASS | heap not reported |
| texture_mem | PASS | 216551234 bytes |
| video_decoders | PASS | 3 |
| active_videos | PASS | 3 |
| draw_calls | PASS | 8 |
| perf_line | PASS | texMB=206.519, activeVideos=3 |
| render_source | PASS | scanned=true, files=1, findings=0 |

Layer commits: `9364283` walls, `ad16d10` ground, `de81922` cutouts, `1c416cf` haze, `bcd42df` first planet loop, `e266efb` replacement planet loop.
