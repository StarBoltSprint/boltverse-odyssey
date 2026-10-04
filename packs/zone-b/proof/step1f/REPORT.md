Built: an emptier base sky, the ringed planet as its own keyed video, and a 6,500 m² canyon floor. IN TEST. Not a lock.

Verdict: IN TEST

Checked: root `npm test` exit 0. `tools/playcheck` npm test 43 pass / 0 fail. Live playcheck exit 1, 24 pass / 7 fail, on `clearing/1` (table below). Sky `check.py` 84 failures (eight horizon files are one frame; budget closed). Phone 720×1600: presented mag 0.982, planet mag 0.5, drawCalls 6, texture bytes 218084034 (208.0 MiB), active videos 2, WebGL errors 0. heroCount 1 on the chase budget pose.

Imagine calls: 12 images, 1 video. Budget was 12 and 4. The haze frame was not installed. Sky bytes versus HEAD: −1,636,215 (−1.56 MiB). Pack `packs/zone-b` 26,494,762 bytes (25.3 MiB), under 150 MB.

Walkable area: 6,500 m². Length 143.73 m. Width at z = 60, 40, 20, 0, −20, −40, −60: 47.5, 44.5, 40.5, 41.5, 44.0, 47.5, 47.0 m. Loop: plaza, slot, basin, wash, outpost, mesa road, return to plaza.

Known issues: the upper gradient, repeated nine times, shows a vertical join when that join is inside the 22.7° field. Nothing is painted above 28.88°. The ground crack lattice is still visible after a 0.75 family mix. The near butte still meets the ground on a straight cut. `contain()` stops on the outline. Live playcheck on `clearing/1` is the circle schema; the same seven rows as step 1e stay open. Those misses stay.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Chase, sky-up, planet-close, slot, and basin show one planet, full rings, both moons, and no second planet. Wide has no dome and no milky fog. Planet-close pitch 3.79°. Sky-up pitch 4.00°. | PASS |
| Ground | Area 6500 m². Length 143.73 m. Width 40.5–47.5 m. Boot maxSlope 0.227 rad. Skirt lift 3.5 m. Fog density 0.0012, cap 0.08. The crack lattice still reads. | FAIL |
| Sky | `check.py` 84 failures. Planet heading 180°, elevation 15°, 380 m, mag 0.5, world 135.60×76.28 m, video on. Card alpha 0.004, blend off. Upper join remains off-axis. | FAIL |
| Magnification | Presented 0.982 on chase, wide, sky-up, planet-close, slot, basin, mesa. Planet 0.5. Ground on chase 0.825. Butte on the budget pose 0.461. | PASS |
| Perf | drawCalls 6, texMB 208.0 (218084034 bytes), activeVideos 2, WebGL errors 0. HUD off in the proof shots. | PASS |
| playcheck | Unit tests 43/43. Live circle walk on `clearing/1`: see the table. `mag_max` 0.982. `solids_world_locked` objects=5, pairs=92, identical=2. | FAIL |
| Gates | npm test exit 0. playcheck npm test 43 pass. sky check 84 failures. Live playcheck exit 1. | FAIL |
| Docs | sky.md Part 3, ground.md Part 2b, decisions-log 2026-10-04, self-improvement zone B rows, METHOD.md zone B row and the 18:58 sky row. All IN TEST. | PASS |
| Proof | Seven JPEGs at 720×1600 and `map.png` in this folder and in `/workspace/grokcli/out/zoneB/step1f/`. | PASS |

Shots (720×1600 JPEG, canvas `toDataURL`, HUD off):

- `chase.jpg` — gallop, heading 180, pitch −2.37°, mag 0.982. Eye about [0, 2.64, 48.6]. Planet video ready.
- `wide.jpg` — `lookAt([-36,16,-20],[33,3.4,38])`, heading 50, pitch −7.96°, mag 0.982. Ground mag 0.068.
- `sky-up.jpg` — pitch 4.00°, mag 0.982. Planet video ready. No black cap.
- `planet-close.jpg` — pitch 3.79°, mag 0.982. Rings and both moons in frame. Planet video ready.
- `slot.jpg` — heading 180, pitch −5.13°, mag 0.982.
- `basin.jpg` — heading 180, pitch −3.98°, mag 0.982.
- `mesa.jpg` — `lookAt([16,6,4],[46,1,22])`, pitch −8.13°, mag 0.982. The loft base is still a straight cut.
- `map.png` — top-down loop, 900×1400, buttes outside the outline.

Loft (`mesas.js`, one draw): butte-0 worldH 12.31, baseY −0.27, seat 2.33. butte-1 worldH 7.04, baseY −0.45, seat 2.15. butte-2 worldH 10.45, baseY 0.15, seat 2.75. Texture array 1120×1280, 10 layers, uploadError 0, 654 tris. Sink 2.6 m.

Run: `python3 -m http.server 8766 --bind 127.0.0.1` from this worktree. Play URL: `http://127.0.0.1:8766/packs/zone-b/play/index.html`. Sky gate: `python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json --out /tmp/zb-skycheck-1f` (84 failures). Root `npm test` exit 0.

Boot `groundInfo`: tris 57774, verts 30442, area 6500, minH −2.964, maxH 3.626, maxSlope 0.227.

Live playcheck (`node tools/playcheck/run --url http://127.0.0.1:8766/packs/zone-b/play/index.html --layout packs/zone-b/clearing.json --no-video`, out `tools/playcheck/out/2026-10-04T18-21-04-284Z`, gitignored): exit 1. Result FAIL, 24 pass / 7 fail. Same seven row names as step 1e. `mag_max` 0.982 at 01-spawn. drawCalls 6. textureBytes 218084034. activeVideos 2. `tile_repeat` worstPeak 0.897. `backdrop_res` mag 0.991. The layout was not converted to `clearing/2`.

| row | result | numbers |
|---|---|---|
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.982, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.982, at=01-spawn, limit=1, missing=0 |
| fix_hint | PASS | reportOnly |
| stops_visible | FAIL | stops=8, invisible=8 |
| collider_eq_visual | FAIL | tolerance_m=0.5, stops=8, bad=8 |
| solids_world_locked | FAIL | objects=5, pairs=92, identical=2 |
| layout_rendered | PASS | objects=0 |
| ring_closed | FAIL | dataHits=0, dataMissCount=360, renderHeadings=36, renderMiss=36 |
| gate | FAIL | empty detail |
| near_lens | PASS | nearest_m=80 |
| fog_band | FAIL | patches=0, fogPixels=0 |
| black_regions | PASS | hitCount=0 |
| tile_repeat | PASS | worstPeak=0.897, worstLag=4 |
| backdrop_res | PASS | mag=0.991, sourceH=720 |
| single_hero | PASS | heroCount=1, frames=128 |
| single_bolt | PASS | |
| idle_gallop_switch | PASS | |
| fullscreen | PASS | 720×1600 |
| debug_hook | PASS | |
| fps_avg | PASS | informational, software GL, fpsAvg=6.34 |
| fps_1low | PASS | informational, software GL |
| frame_ms | PASS | informational, software GL |
| js_heap | PASS | heap not reported |
| texture_mem | PASS | 218084034 bytes |
| video_decoders | PASS | 2 |
| active_videos | PASS | 2 |
| draw_calls | PASS | 6 |
| perf_line | PASS | texMB=207.981, activeVideos=2 |
| render_source | FAIL | scanned=false, findings=1 (this command does not pass `--source`) |
