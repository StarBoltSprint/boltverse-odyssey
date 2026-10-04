# playcheck

Rendered-pixel play test. One command loads a play build in headless Chrome (software WebGL is enough), drives the hero through a scripted walk, and judges the **framebuffer**. A data-only PASS is FAIL. Any WebGL error is FAIL.

The tool measures. It does not draw, shade, or restyle the game. Visible pixels stay Imagine assets in the play build. The fixture under `fixture/` is a harness for this repo only. It is not a biome and not a play build.

## Install

Plain Linux, no GPU. Chrome or Chromium, Node 22, ffmpeg.

```bash
# Debian / Ubuntu. The image's Chrome is enough when it is already installed.
sudo apt-get install -y ffmpeg
# google-chrome-stable, or: sudo apt-get install -y chromium
cd tools/playcheck
npm install
```

`PLAYCHECK_CHROME` overrides the binary. Default search: `/opt/google/chrome/chrome`, `google-chrome`, `chromium`.

Launch flags (software GL): `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`.

## Run

```bash
tools/playcheck/run --url <play url or local build path> --layout <clearing.json>
tools/playcheck/run --url https://example/play --layout packs/zone-a/clearing.json --out /tmp/playcheck
tools/playcheck/run --url ./dist --layout clearing.json --no-video
```

- `--url` is an `http(s)` play URL or a local file or directory (served on 127.0.0.1).
- `--layout` is the zone `clearing.json`. Keys are the doc 63 set. No style words.
- `--out` is the report folder. Default `tools/playcheck/out/<timestamp>`.
- `--video` is **on by default**. `--no-video` skips the mp4.

Phone portrait, full screen: viewport **360×800 CSS**, device pixel ratio **2**, framebuffer **720×1600**.

Exit **0** only when every row is PASS. Exit **1** when any row FAILs. Exit **2** when the tool itself cannot run.

## What the walk does

1. Spawn.
2. Full 360° turn, stills every 45°, horizon samples every 10°, and an orbit screenshot every 5° under `stills/orbit/`. Those frames are the `solids_world_locked` measurement.
3. Walk to the first gate until the path trigger or a stop.
4. Walk outward on 8 headings (every 45°, skipping the gate opening) until a collider stops the hero, then wait for idle.
5. Walk up to each `interior_objects` entry.
6. Gallop, then stop and wait for idle.

Input is `window.__play` (`setInput`, `tick`, `look`, `reset`). Keyboard (WASD / arrows) and the on-screen stick are the human path. The hook is required for the scripted walk.

## Organic layout

When `--layout` is schema `clearing/2`, or `zone.shape` is `organic`, the walk is a waypoint route. The circle walk above is unchanged. Circle reports stay byte-identical and do not emit the four organic rows, `fade_in`, or `preload_ahead`. An organic report does not emit `ring_closed`, `stops_visible`, or `collider_eq_visual`. `fade_in` is emitted only when that layout has a `streaming` object. `preload_ahead` is also emitted when the page snapshot declares streaming (`snapshot().streaming` truthy, or `snapshot().cells.streaming === true`). Round mode, and an organic page that does not declare streaming, never emit them.

1. Spawn, then a 360° ID sweep. A still is taken at the spawn.
2. Walk every sub-area centre and along every passage polyline. The route is the layout graph (sub-area centres plus passage centre polylines). A still is taken at each sub-area. Each waypoint is logged: `waypoint <kind> <name> x <x> z <z>`. `report.json` gains a `waypoints` array, and `report.md` gains a Waypoints section. Both are absent on a circle run.
3. Boundary probes. From inside, walk toward the boundary along its outward normal about every 10 m of boundary length. A sample whose 10 m cell overlaps a gate span is skipped. The stop must be blocked and within **0.5 m** of a visible boundary piece (`boundary_visible`). An invisible stop is FAIL. Owner decision 2026-10-02, spec rail 10.
4. Walk the first gate until `pathTrigger`, then gallop, then idle.

`discovery` is rendered. A POI with intent `hidden_from_spawn` has 0 ID pixels on the spawn sweep and a count above 0 later on the route. At least two such POIs. A landmark covers at least **1%** of the frame on at least **60%** of route samples. The row prints `spawn_px`, `route_px`, and `landmark_frac`. Owner decision 2026-10-02, spec rail 10.

`no_pop`: an object above **3000 px** that drops below **20%** of that area in one frame, while its id is still in `snapshot().frustum`, is FAIL. Leaving the frustum is not a pop. The check covers LOD switches and cell loads. The page sets `snapshot().areas` (id to pixel count) and `snapshot().frustum` (ids in view). Without `frustum` the row FAILs and the detail is `n/a (page lacks field frustum)`. Owner decision 2026-10-02, spec rail 11.

`cells` reads the last snapshot's `cells` or `cellPerf`: `resident`, `total`, `triVisible`, `lod0`, `lod1`, `lod2`, `cellLoad_ms_max`, `texMB_peak`. Without a streaming declaration, a missing field is the string `n/a (page lacks field X)` and does not fail. The tool does not copy a number from the layout file and does not store 0 for a missing field. `triVisible` above **300000** is FAIL. `cellLoad_ms_max` is report-only when the field is present. `texMB_peak` is reported and is not a second fail against `texture_mem`. `lod0`, `lod1`, `lod2`, and `texMB_peak` stay `n/a` when absent and do not fail on their own. When the layout has a `streaming` object, or the page declares streaming (`snapshot().streaming`, or `cells.streaming` / `cellPerf.streaming` true), a missing `resident`, `total`, `triVisible`, or `cellLoad_ms_max` FAILs with `missing field X`. Director decision 2026-10-02 15:04 (delegated owner approval). Owner decision 2026-10-02, spec rail 11, still sets the 300000 cap. `cells.resident` stays a count. It is not an id list.

`fade_in` runs only when the layout `streaming` block is present. `preload_ahead` also runs when the page snapshot declares streaming. The walk keeps a heading predictor: position plus heading (or `vx`/`vz` when heading is not finite) stepped every 2 m out to `preload_lookahead_m`. Heading 0 faces +z and 90 faces +x. The last point is the lookahead. The tools measure. The engine applies the fade and the preload later. The fade is alpha on existing pixels. This command does not draw it.

`fade_in` uses `snapshot().opacity` when that object is present, otherwise `snapshot().areas`, otherwise the ID-buffer counts. One id does not mix those scales. The rule: a fade from alpha 0 applies only to an object that was not on screen before it entered range (outside the frustum, occluded, or beyond fog). An object already visible as its far representation must crossfade to the near representation and must never drop to 0. A jump above **20%** of its final value in one frame is FAIL (same 20% figure as `no_pop`). The measured time must sit in **300–600 ms** (owner decree #457, approved 2026-10-02) unless `fade_in_distance_m` is set and the samples carry `distance_m` whose span is above 0 and within that distance. A one-frame jump still fails in distance mode. A far representation that drops to 0 while it is still on screen is FAIL, even when a later ramp is smooth. If `frustum` is absent the row does not invent "on screen" and does not count that vanish. The row prints `count`, `worst_ramp_ms`, and `worst_jump`. No clock, with a clean jump and no vanish, is `n/a (page lacks field t_ms)` and does not fail. No opacity, areas, or counts is `n/a (page lacks field opacity)` and does not fail.

`preload_ahead` requires every cell inside the heading cone, within `preload_lookahead_m` of the hero, to be resident before the hero enters it. The cell that already contains the hero is not in that cone. Residency is `snapshot().cells.residentIds` (or `cells.resident` only when that value is already an array of strings) on a strictly earlier sample. The row prints `misses` and `worst_lead_ms` (the tightest lead). When streaming is declared (layout `streaming`, or the page flag above), a missing `residentIds` FAILs with `missing field residentIds` and does not stay `n/a`. Without that declaration, a numeric `cells.resident` is not a list: the row is `n/a (page lacks field cells.residentIds)` and does not fail, and it does not store 0 for the miss count. Director decision 2026-10-02 15:04 (delegated owner approval). A missing clock alone does not invent a fail when the id lists are present; the lead is then `n/a (page lacks field t_ms)`.

The labelled page is `fixture/organic/` (`TEST FIXTURE - not Imagine`, flat ID colours). `?fixture=discover` shows a hidden POI from the spawn. `?fixture=boundary` stops short of the visible pieces. `?fixture=pop` drops one object's area in a single frame. Pass is the URL with no `fixture` query.

## Debug hook — builders must keep this

When the URL has `?debug=1` (the tool adds it), the play view must set `window.__play` before the first frame finishes:

```js
window.__play = {
  version: 1,
  ready: true,
  reset() {},
  look(headingDeg) {},
  setInput({ forward, turn, gallop }) {},
  tick(dtSeconds) {},
  snapshot() {
    return {
      x, z, hdg, spd, mag, state,          // state is "IDLE" or "GALLOP"
      heroCount, blocked, pathTrigger,
      gate: { id, bearing_deg, dist_m },
      nearestVisibleM,                     // closest non-hero fragment that passed alpha
      magSources: { ground, backdrop },    // optional; included in mag_max
      canvas: { width, height },           // backing store, 720×1600
      backdrop: { sourceW, sourceH, screenW, screenH, fovDeg },
      objectIds: { width, height, labels, b64 },
      perf: {}   // optional; see Phone performance below. Required on a real play URL.
      // Optional, only read when the layout has streaming. Absent fields stay absent:
      // opacity, areas, representation, frustum, occluded, beyondFog, far, t_ms, distance_m,
      // cells.residentIds
    };
  }
};
```

`objectIds.b64` is little-endian `Uint16`, row 0 at the top of the screen. `labels[value]` is the layout id. `0` is empty. Edge hulls use their `id`. Gates use `gate:<id>`. Interiors use their `id`. The hero label is `hero`. Fog labels are `fog`.

The ID buffer must be the same draw list as the colour view, with the same alpha discard. A texel that is cut out writes no id. An object that exists only in JSON, the debug map, or the collider set, and writes no id, is absent.

`tick` advances the simulation and draws. `mag` is the same number as the HUD. Heading: `0` faces +z, `90` faces +x.

WebGL errors are captured even without the hook, by wrapping `getError` and the console. The hook does not replace that.

## Report

| File | What |
| --- | --- |
| `report.md` | PASS/FAIL table. This is the report a builder pastes. |
| `report.json` | The same rows as data. |
| `stills/` | One PNG per scripted step, 720×1600. |
| `walk.mp4` | H.264, 30 fps, 720×1600 (or 360×800 if that is what fits), HUD visible. |

`walk.mp4` is a CDP screencast of the viewport, encoded with ffmpeg. It is capped near **15 MB** (re-encode, then a 360×800 fallback). `--video` defaults on.

## Rows

| Row | FAIL when |
| --- | --- |
| `webgl_errors` / `webgl_clean` | Any `gl.getError` or console WebGL error, including `texSubImage3D`. |
| `mag_max` / `mag` | Peak HUD magnification, including `magSources` when present, is above `view.mag_max` (1.0). |
| `fix_hint` | Always PASS. Report only. Names the object and stop behind the worst `mag_max` (from `magHits`, else the largest `magSources` key) and a farther camera (`dist * mag / limit`) or a smaller scale (`scale * limit / mag`). When `snapshot().heroVisible` is under 0.85 it names that fraction. It does not change the failed-row count. |
| `stops_visible` | A stop is not in contact with a layout surface (blocked, or within 0.5 m), or nothing from the layout covers the view ahead. Flat black and pixels that match unlabeled ground do not count. |
| `collider_eq_visual` | Stop is more than 0.5 m from a layout surface, or the surface is not visible. |
| `solids_world_locked` | A solid's screen crop stays pixel-identical (mean absolute error ≤ 3/255) across a consecutive orbit step of 3–7°. Zero identical pairs is the only pass. No orbit frames is a FAIL. The measurement harness (`snap.harness`) records the count as partial and does not apply it. Hero, fog, and `gate:` labels are skipped. |
| `layout_rendered` | A hull, gate, or interior that the walk faced never wrote visible pixels. |
| `ring_closed` | A 1° data ray misses outside the gate span, or a 10° heading from the centre shows no edge pixels. |
| `gate` | Gate frame not visible at its heading, HUD bearing/distance off, or the opening never sets `pathTrigger`. |
| `near_lens` | `nearestVisibleM` missing or inside `near_lens.cull_m`. |
| `fog_band` | Fewer than 20 patches in the file, or fog pixels missing / hard-edged. |
| `black_regions` | A large flat near-black rectangle. A full-width night-sky band that touches the top is ignored. |
| `foot_contact` | Sky-coloured pixels between a solid and the ground in the same columns. A frame under 48 px is skipped. A distant skyline that meets the ground does not fail. Added 2026-10-04. |
| `untextured` | A large black or flat untextured region. A full-width night band that touches the top is ignored. This does not replace `black_regions`. Added 2026-10-04. |
| `mag_hotspots` | A `snapshot().magHits` entry above `view.mag_max`. The detail names each hotspot and three fixes: move the camera out (`dist * mag / limit`), set scale to `scale * limit / mag`, or recook the skin at `texels * mag / limit` texels/m and do not enlarge the current texture. `fix_hint` stays PASS and still names only the worst hit. Added 2026-10-04. |
| `stair_crown` | A silhouette crown of long flat steps. The detail names a finer loft grid, a smoother silhouette, and a recook at the on-screen pixel count. Added 2026-10-04. |
| `tile_repeat` | Obvious periodic repetition on the ground band. |
| `backdrop_res` | On-screen ring pixels exceed the source pixels of that slice (`screen / (source × fov/360)`, and sky height / source height). |
| `single_hero` / `single_bolt` | Not exactly one `hero` blob, or idle and gallop were not both captured. |
| `idle_gallop_switch` | Moving frame is not `GALLOP`, or the stop frame is not `IDLE` at about speed 0. |
| `fullscreen` | Canvas or screenshot is not 720×1600. |
| `debug_hook` | `snapshot()` or the ID buffer is missing. |
| `transition_black` | Only when `snapshot().transition` is present. A frame is black (luma under 12 on at least 92% of sampled pixels), or `black` / `rgba` was not provided. |
| `transition_hitch` | Only when `snapshot().transition` is present. `hitchMs` is missing or the largest value is over 100. |
| `fps_avg` | `snapshot().perf` missing is FAIL. On this command's SwiftShader run a low average is informational and does not fail the take. Not applied on the measurement fixture (`snap.harness`). |
| `fps_1low` | Same as `fps_avg` for the slowest 1% of the last 300 intervals (floor 20 on a device GPU). SwiftShader does not fail the take. |
| `frame_ms` | `snapshot().perf` missing is FAIL. A mean present interval above **33.333 ms** is informational on SwiftShader and does not fail the take. |
| `js_heap` | Reported `usedJSHeapSize` above **384 MiB**. Missing `performance.memory` is PASS, `available: false`, partial. |
| `texture_mem` | Estimated GPU texture bytes above **256 MiB**. |
| `video_decoders` | More than **6** concurrent decoders. |
| `draw_calls` | Peak draws in a frame above **150**. |
| `active_videos` | More than **4** videos decoding in a captured frame. Law 65. The older `video_decoders` cap (6) stays. |
| `perf_line` | `drawCalls`, `texMB`, `activeVideos`, or `jsMs` was not reported. The report also prints `Perf: drawCalls=<n>, texMB=<n>, activeVideos=<n>, jsMs=<n>`. |
| `render_source` | Play source was not scanned, or the scan found `NEAREST` on a world texture, `bufferData` of a new typed array, a non-instanced draw inside a loop, or `camQuad` on a solid. An object-ID buffer may use `NEAREST`. |
| `boundary_visible` | Organic only. A non-gate probe is not blocked, the piece ahead is not visible, or the gap to the nearest boundary piece is over **0.5 m**. Samples are every **10 m**. Owner decision 2026-10-02, spec rail 10. |
| `discovery` | Organic only. A `hidden_from_spawn` POI has ID pixels on the spawn sweep, is never reached on the route, fewer than 2 such POIs exist, or the landmark covers under **1%** of the frame on under **60%** of route samples. Owner decision 2026-10-02, spec rail 10. |
| `no_pop` | Organic only. An in-frustum object above **3000 px** drops below **20%** of that area in one frame. Owner decision 2026-10-02, spec rail 11. |
| `cells` | Organic only. `triVisible` above **300000**. Without a streaming declaration a missing snapshot field is `n/a (page lacks field X)` and does not fail. When streaming is declared, a missing `resident`, `total`, `triVisible`, or `cellLoad_ms_max` FAILs with `missing field X`. `lod` counts and `texMB_peak` stay `n/a` and do not fail on their own. Director decision 2026-10-02 15:04 (delegated owner approval). The 300000 cap is owner decision 2026-10-02, spec rail 11. |
| `fade_in` | Only when the layout has `streaming`. The rule: a fade from alpha 0 applies only to an object that was not on screen before it entered range (outside the frustum, occluded, or beyond fog). An object already visible as its far representation must crossfade to the near representation and must never drop to 0. Also FAIL: a jump above **20%** of the final value in one frame, a ramp that is not monotonic, or a measured time outside **300–600 ms** without a passing distance span. Owner decree #457, approved 2026-10-02. Spec rail 11. A missing opacity or clock field is `n/a (page lacks field X)` and does not fail. |
| `preload_ahead` | When the layout has `streaming`, or the page declares streaming. A cell inside the heading cone and the lookahead is not resident before the hero enters it. Prints `misses` and `worst_lead_ms`. A declared-streaming page missing `residentIds` FAILs with `missing field residentIds`. Without that declaration the same gap is `n/a` and does not fail. Director decision 2026-10-02 15:04 (delegated owner approval). Owner decree #457, approved 2026-10-02. Spec rail 11. |

`fps_avg`, `fps_1low`, and `frame_ms` are measured on SwiftShader in this command. Those three rows are informational on that run and do not fail the take. A missing `snapshot().perf` is still FAIL. Law 65: [`biome/docs/65-render-quality.md`](../../biome/docs/65-render-quality.md).

These rows are additive. The rows above the phone block are unchanged. A hand-written PASS is not a PASS.

`--source <play.js>` (repeatable) scans that file. A local `--url` directory is scanned for the `.js` files in that directory. A remote URL without `--source` fails `render_source`. The fixture (`snap.harness`, or `tools/playcheck/fixture`) records the row and does not apply it.

```bash
node tools/playcheck/src/renderlint.mjs <play.js>
```

Exit 0 is a clean scan. Exit 1 is a finding. The scan is the same function the walk uses.

## Phone performance

Include [`tools/perf/overlay.js`](../perf/README.md). The panel is off unless the URL has `?perf=1`. This command does **not** add that flag (it adds `?debug=1` only), so the walk does not cover the controls. The script still installs `window.__perf`.

The play view calls `__perf.noteFrame`, `__perf.noteDraw`, and `__perf.noteTexture`, and copies `__perf.snapshot()` onto `snapshot().perf`.

`report.json` gains an additive `perf` object, schema `playcheck-perf/1`, documented for `tools/reportview`:

| Field | Meaning |
| --- | --- |
| `perf.schema` | `playcheck-perf/1` |
| `perf.thresholds` | The mid-range phone caps (`fpsAvgMin` 30, `fps1LowMin` 20, `frameMsMax` 33.333, `heapBytesMax` 402653184, `textureBytesMax` 268435456, `videoDecodersMax` 6, `activeVideosMax` 4, `drawCallsMax` 150). |
| `perf.perfLine` | `Perf: drawCalls=<n>, texMB=<n>, activeVideos=<n>, jsMs=<n>`. Required on every report. |
| `perf.budgetApplied` | False only for the measurement fixture. |
| `perf.harness` | True when every frame was `snap.harness`. |
| `perf.aggregate` | Walk totals: `fpsAvg`, `fps1Low`, `frameMs`, `frameMsAvg`, `heapBytes`, `heapAvailable`, `textureBytes`, `videoDecoders`, `drawCalls`, `samples`. |
| `perf.samples[]` | One object per captured step, same numbers plus `step` and `scripted`. |

Existing report keys (`tool`, `url`, `layout`, `rows`, `summary`, `viewport`, `video`, `stills`, `steps`, `notes`, `generatedAt`) stay. Row objects stay `{ id, result, numbers, detail, heuristic, partial }`.

The fixture under `fixture/` is a harness. It records perf and does not fail the phone budget, because its tile loop is a test pattern, not a phone scene. A play URL without `harness: true` is judged.

## Honest limits

- `black_regions`, `tile_repeat`, and the fog streak test are **heuristics**.
- Outward stops are **8 headings** (every 45°), not 36 separate walks. Horizon coverage is **36 headings** (every 10°) from the centre during the turn. `ring_closed` / `stops_visible` / `collider_eq_visual` are marked partial for that reason.
- `backdrop_res` and `mag` use sizes and the HUD number the renderer reports on the live hook. The colour cross-check rejects an ID buffer whose pixels are empty ground or flat black. A hook that lies about both the sizes and the pixels can still fool a row. The screenshots are the proof a person can look at.
- `near_lens` is the renderer's nearest fragment distance, required on every frame. It is not a second depth buffer inside this tool.
- The committed samples under `sample/` are runs of `fixture/`, because this repo has no clearing play build. `sample/clean` is the harness with objects drawn. `sample/take8` reproduces invisible stops, a missing gate, an unkeyed black rectangle, a repeated floor, an upscaled ring, magnification above 1, and a real `texSubImage3D` error. Those committed files predate the perf rows. A new run writes the additive `perf` object and the seven perf rows. On this harness the phone budget is recorded and not applied.
- FPS is the present interval the page reports via `noteFrame`. This walk calls `tick(1/30)`, so a harness that forwards that `dt` is reporting the driven interval. `workMs` is accepted by the counter but the fps rows use `dtMs` when it is set. A device build should pass `requestAnimationFrame` deltas. The counter does not read the GPU clock.
- `transition_black` and `transition_hitch` are omitted unless a captured `snapshot().transition` exists (one object, an array, or `{ samples: [...] }` with `black` or `rgba`, and `hitchMs`). A walk that never leaves its clearing keeps the previous row set, plus the perf rows. The zone handoff itself is `biome/scripts/zone-flow`. The labelled synthetic demo is `tools/zoneflow`.
- Organic `layout_rendered` checks the gates and the POIs the route is responsible for. It does not require a pixel from every boundary piece. Boundary contact is `boundary_visible`.
- A probe origin is **1.5 m** inside the footprint along the outward normal. If that point is not strictly inside (a 0.15 m neighbourhood also inside), the origin slides along the edge so it is not sitting on a piece. The walk then stages a few metres further inside, clear of piece radii, and the outward march uses the probe heading. The 0.5 m stop gap is unchanged. If a contact blocks the route, the walker steps away from the nearest piece and tries again.
- A gate sample is skipped when the 10 m cell overlaps the gate span (arc distance at most 5 m plus half the span). The skip is not a looser gap.
- The measured gap is from the hero centre to the piece radius. One simulation step can stop short of the visual. The organic fixture walks at 6 m/s so the last step stays inside 0.5 m. A longer step on a correct visual can false-fail the row.
- `cells` with no streaming declaration prints `n/a` and stays PASS unless `triVisible` is present and over 300000. The organic fixture reports a constant cells block and does not declare streaming, so that `n/a` path stays. When streaming is declared, a missing `resident`, `total`, `triVisible`, or `cellLoad_ms_max` FAILs with `missing field X`. LOD counts and `texMB_peak` stay `n/a`. The tool does not invent the missing numbers. Director decision 2026-10-02 15:04 (delegated owner approval).
- `fade_in` is omitted when the layout has no `streaming` object. `preload_ahead` is also emitted when the page declares streaming. Round mode never emits them. Without that declaration, a page that lacks `opacity`, `t_ms`, or `cells.residentIds` prints `n/a (page lacks field X)`. With it, a missing `residentIds` FAILs with `missing field residentIds`. The tool does not store 0 for that field. `cells.resident` stays a count. The rule: a fade from alpha 0 applies only to an object that was not on screen before it entered range (outside the frustum, occluded, or beyond fog). An object already visible as its far representation must crossfade to the near representation and must never drop to 0. The command does not draw the fade, recommend `NEAREST`, a lower mip, a DPR cut, or dropping a visible solid. The engine applies alpha on existing pixels later. Synthetic captures in `src/streaming.test.mjs` are labelled `TEST FIXTURE - not Imagine`.

## Pre-merge

Before a details or polish branch lands on a gate:

```bash
node tools/playcheck/src/premerge.mjs --audit
node tools/playcheck/src/premerge.mjs
node tools/playcheck/src/premerge.mjs --full --resume
```

`--audit` only checks rock discs against gate and hangar walk passages. The default also runs the unit tests and skips the long ruin walk. `--full` adds that walk (openings, hangar, camera shake). Progress defaults to `/tmp/playcheck-premerge-progress.json`. `--selftest` uses a synthetic manifest. A hit is a FAIL. The command does not rewrite `packs/*/src/rocks/manifest.json`.

## Tests

```bash
cd tools/playcheck && npm test
```
