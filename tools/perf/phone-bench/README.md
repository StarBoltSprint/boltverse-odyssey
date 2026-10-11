# Phone bench and A/B identity tools

These tools find where a real phone spends its frame time and prove that a performance change leaves every pixel the same. Method: [docs/METHOD/phone-perf.md](../../../docs/METHOD/phone-perf.md).

| File | What it does |
|---|---|
| `bench.html` + `bench.mjs` | One-link benchmark for the owner's phone (v6, about 1 min 30, no touch). It loads the staging game, compiles every variant, warms up for 8 s and holds fixed poses (avenue view plus a looking-down ground view). Each row is measured **thermally fair**: base / row / base / row, with a 1 s idle cool-down between rows. Each row also shows fps (1000 / ms). Phase 2 runs the game's quality-first controller (ratio 2, emergency floor only) on normal vsync frames for 24 s and reports the ratio and the median fps over the last 8 s. v6 also logs every segment (`segs`: tag, retry, intervals, ms, raw median, rAF calls). It shows a large table and a shareable result link (`bench.html#r=<base64 JSON>`). Opening that link only shows the table and runs nothing. |
| `compare.html` + `cmp.mjs` | Owner's eye test: the same frozen view, tap to toggle. A = native ratio 2; B = ratio 1.5 upscaled with a de-ringed Catmull-Rom (FSR1 EASU-style clamp) + RCAS at full resolution; C = ratio 1.5 with the game's bilinear + RCAS. Each mode's fps is measured at start (pipelined, ABCABC). `?low=` sets the low ratio, `?sharp=` the RCAS amount (default 0.8). |
| `decode.mjs` | Turns a result link into JSON or a markdown table. `--target <ms>` exits 1 when the base is slower than the target (v4+: the first, coolest base). |
| `ab-identity.mjs` + `ab_sheet.py` | A/B identity proof (`order` or `fill` mode, or add your own switch). Same page, frozen time, same pose. Renders the new path and the old path (switched in-page), reads back the full canvas and writes a sheet (new / old / diff ×16 crops) with mean, max and changed-pixel %. Poses look at the ground 1.5, 3, 8 and 30 m ahead. |
| `ab-look.mjs` | Measures how far a `[look]` candidate moves the image (same capture as `ab-identity.mjs`, one subfolder per candidate; in its sheet the second column is the candidate). |
| `overdraw.mjs` | Exact fragment counts per transparent layer, depth-tested against the opaque scene. Use this instead of guessing a layer's cost from timings. |

## Thermal fairness (v4)
A phone heats up over a run: in v3 the same base went from 45 to 57 ms in 4 min, so rows measured later looked slower.
v4 never compares a row with a base measured minutes earlier. Each row reports:
- `b`: the mean of its own two base segments;
- `ms`: the mean of its two row segments;
- `d` / `p`: the difference in ms and %;
- `norm`: the row/base ratio times the first, coolest base;
- `spread`: the larger repeat difference. A row whose |d| is not clearly above `spread` is noise.

v5 segment rule: the 3-renders-per-frame pipeline keeps running between segments, each segment drops its first 4 intervals and records at least 10 (at most 5 s). v6: drops 3, waits for 12 (at most 12 s) and retries a segment up to 3 times when it got fewer than 4; on the phone v5's 5 s cap left the first three rows empty. v4 used 1.2 s segments: at 45 ms × 3 that is only about 8 intervals, and the first ones read fast while the GPU queue refilled after a pause, which gave impossible bases of 15-34 ms on the S20 FE.

## Metrics (bench v2+)
- **ms** (main number): pipelined cost per frame. Each animation frame renders 3 times with no readback; ms = median rAF interval / 3. This measures whichever of the GPU or CPU is busier, and the 60 Hz vsync does not cap it while the cost is above 5.6 ms.
- **cpu**: JS time of one render call (submit side).
- **sync**: the v1 metric (render + 1 px `readPixels`), shown for reference only. On Chrome Android it adds a GPU round trip and serialises CPU and GPU: v58 read 38.8 ms "sync" while it ran at about 60 fps.

## Page contract (what bench.mjs needs from the game page)
`window.__ready`, `window.__st` (pose: x, z, yaw, pitch, y), `window.__gd.field.surfaceHeight`, `window.__gd.groundU` (ground uniforms),
`window.__gdTHREE`, and `window.__gdProf = { world, grade, sky, ground, renderer, camera, render() }`. The frame loop must call
`window.__benchRender()` instead of rendering when it is set. Optional: `window.__groundFill({ hr8, pre })` (lossless ground switches, built with `tools/biome/runtime/ground-fill.mjs`). Load the page with `lockq=1&dyn=0&hud=0&grain=0` so the adaptive ratio stays off and the grain is static.

Rows tagged `[diag]` change the look. They only locate the cost and are never proposals (owner rule: the ground look is untouchable).
Rows tagged `[look]` are "nearly invisible" candidates the owner asked to price. Their label carries the measured A/B mean diff. They are never made default by the bench. (v5 priced two; no gain on the phone, dropped in v6.)

## Use on a new page
1. Copy `bench.html` and `bench.mjs` next to the game's staging page, with `runtime/adaptive-res-v3.mjs` (a copy of `tools/biome/runtime/adaptive-res.mjs`) beside them for the adaptive phase.
2. Make a `main-bench.mjs` copy of the game entry that honours the page contract above (the `__benchRender` hook in the frame loop).
3. `bench.html` loads `./main-bench.mjs`, waits for `__ready`, then imports `./bench.mjs`.
4. Edit the row list `A` in `bench.mjs` for the scene. Each row is `[name, pose, toggle]`. `toggle()` applies the change and returns an undo function, which must restore everything it changed. v4 calls it twice per row (ABAB) and once in the warm-up to compile.
5. Send the owner one link. They paste back the `#r=` link, which you read with `node decode.mjs '<link>' --md`.

The Zone B copy (2026-10-10) is served from the staging preview as `bench.html`.

A/B identity, run on the box:
`PLAYWRIGHT_MODULE=… node ab-identity.mjs "<staging url>?opt=1&cap=2&lockq=1&dyn=0&hud=0&grain=0" <out> [order|fill]` then `python3 ab_sheet.py <out>`.
Pass: mean ≤ 1/255 at every pose (expected 0), and the `nw2` self-check (the new path rendered twice) must be 0, otherwise the capture is not deterministic.
