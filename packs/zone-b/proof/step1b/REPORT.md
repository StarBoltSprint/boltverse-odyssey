Built: Ember Mesa horizon is the ten full 1280×720 frames (−4.31° to 17.12°, mag 0.990), zone A night bands are not referenced, dust gain 0, sky shell at 640 m with clip far 720 m, ground skirt to 480 m in the same mesh, ground tile 1.42 m, three yaw-locked butte cards outside the walk radius. IN TEST. Not a lock.

Checked: playcheck 24 pass / 7 fail (exit 1) on `clearing/1`; sky `check.py` 38 failures; sky selftest PASS; root `npm test` exit 0; `tools/playcheck` npm test 43/43; `kit.py check` PASS. Presented mag 0.990, turn ground mag 0.976, wide butte mag 0.898, drawCalls 7, texture bytes 112143298 (106.9 MiB), download directory sum 23549245 bytes, activeVideos 1, WebGL errors 0. Imagine calls 10/12.

Known issues: empty cap above 17.12° (no stars); wide pose still has a dark band under the painted land line; butte cards at headings 75 and 180 still read above the ground line; sky joins and motif fail; layout is still `clearing/1`, so the circle-walk rows fail; micro cutouts are still none.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Chase heading 255: one butte meets the ground and breaks the skyline, sun visible, no slice boxes, no stars. Headings 075 and 180: the other two cards sit above the ground line. Wide: dark band between the painted land line and the ground. Empty cap above 17.12° on every heading. | FAIL |
| Ground | Tile 1.42 m. Skirt to 480 m. Relief unchanged from step 1. Three cards, heights 16.0 / 7.062 / 10.463 m. `details` still `[]`. Body still stops at `contain()`. | FAIL |
| Sky | `check.py` failures 38 (joins MAE 4.13–23.94, close 19.05, motif on sky-0..9, exposure swing 69, combined repeat 10.0 s). Selftest PASS. No zone A night paths. Upper ring not installed. | FAIL |
| Magnification | playcheck mag_max 0.99 at 01-spawn. Proof poses 0.990. Turn ground 0.976 at heading 205. Wide butte 0.898. Horizon magH 0.990. | PASS |
| Perf | drawCalls 7, texMB 106.9 (112143298 bytes), download 23549245 bytes (directory sum of `src` + `play` + the two Bolt files), activeVideos 1. WebGL errors 0. HUD `none` without `?debug=1`. | PASS |
| playcheck | exit 1. 24 pass, 7 fail. Table below. `single_hero` heroCount 1. `mag_max` PASS. | FAIL |
| Gates | npm test exit 0. playcheck npm test 43 pass. sky selftest PASS. kit check PASS. sky check 38 failures. Bolt sha matches the base file. `git diff 5bb1b5d -- lock/ packs/zone-a/src` empty. Imagine 10/12. | FAIL |
| Docs | sky.md Part 3, ground.md Part 2b, decisions-log 2026-10-04. All IN TEST. | PASS |
| Proof | Nine JPEGs in this folder, 720×1600, each under 100 KB. | PASS |

playcheck (`tools/playcheck/run --url http://127.0.0.1:8982/packs/zone-b/play/index.html --layout packs/zone-b/clearing.json --no-video`, out `/tmp/zb-playcheck2`):

| row | result | numbers |
|---|---|---|
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.99, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.99, at=01-spawn, limit=1, missing=0 |
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
| texture_mem | PASS | 112143298 bytes |
| video_decoders | PASS | 1 |
| active_videos | PASS | 1 |
| draw_calls | PASS | 7 |
| perf_line | PASS | |
| render_source | FAIL | scanned=false (this command does not pass `--source`) |

Shots (720×1600 JPEG, canvas `toDataURL`, HUD off):

- `01-chase-gallop.jpg` — spawn, heading 255, state GALLOP, mag 0.990, heroCount 1
- `03-eye.jpg` — spawn, heading 255, state IDLE, pitch −3.79°
- `04-wide.jpg` — `lookAt([-40,18,-24],[6,1,14])`, butte mag 0.898
- `02-sky-000.jpg` `02-sky-075.jpg` `02-sky-090.jpg` `02-sky-180.jpg` `02-sky-255.jpg` `02-sky-270.jpg` — spawn, those headings. 255 is the sun. 075 carries the ringed planet.

Run: `python3 -m http.server 8982 --bind 127.0.0.1` from this worktree. Play URL: `http://127.0.0.1:8982/packs/zone-b/play/index.html`. Sky gate: `python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json --out /tmp/zb-skycheck`.

The four step-1 stills kept as visible pixels: sun slice is `src/sky/sky-7.jpg` (full 1280×720), ringed planet is `src/sky/sky-2.jpg` (full 1280×720). Ground families from step 1 were not replaced.
