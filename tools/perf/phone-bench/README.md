# Phone bench and A/B identity tools

These tools find where a real phone spends its frame time and prove that a performance change leaves every pixel the same. Method: [docs/METHOD/phone-perf.md](../../../docs/METHOD/phone-perf.md).

| File | What it does |
|---|---|
| `bench.html` + `bench.mjs` | One-link benchmark for the owner's phone. No touch is needed and a run takes about 4 min. It loads the staging game, warms up for 8 s, holds fixed poses (avenue view plus a looking-down ground view) and cycles feature toggles. Phase 2 reloads the page on the old path (`opt=0`) for comparison. It shows a large table and a shareable result link (`bench.html#r=<base64 JSON>`). Opening that link only shows the table and runs nothing. |
| `decode.mjs` | Turns a result link into JSON or a markdown table. `--target <ms>` exits 1 when the averaged base row is slower than the target. |
| `ab-identity.mjs` + `ab_sheet.py` | A/B identity proof. Same page, frozen time, same pose. Renders the new path and the old path (switched in-page), reads back the full canvas and writes a sheet (new / old / diff ×16 crops) with mean, max and changed-pixel %. Poses look at the ground 1.5, 3, 8 and 30 m ahead. |
| `overdraw.mjs` | Exact fragment counts per transparent layer, depth-tested against the opaque scene. Use this instead of guessing a layer's cost from timings. |

## Metrics (bench v2+)
- **ms** (main number): pipelined cost per frame. Each animation frame renders 3 times with no readback; ms = median rAF interval / 3. This measures whichever of the GPU or CPU is busier, and the 60 Hz vsync does not cap it while the cost is above 5.6 ms.
- **cpu**: JS time of one render call (submit side).
- **sync**: the v1 metric (render + 1 px `readPixels`), shown for reference only. On Chrome Android it adds a GPU round trip and serialises CPU and GPU: v58 read 38.8 ms "sync" while it ran at about 60 fps.

## Page contract (what bench.mjs needs from the game page)
`window.__ready`, `window.__st` (pose: x, z, yaw, pitch, y), `window.__gd.field.surfaceHeight`, `window.__gd.groundU` (ground uniforms),
`window.__gdTHREE`, and `window.__gdProf = { world, grade, sky, ground, renderer, camera, render() }`. The frame loop must call
`window.__benchRender()` instead of rendering when it is set. Load the page with `lockq=1&dyn=0` so the adaptive ratio stays off during the bench.

Rows tagged `[diag]` change the look. They only locate the cost and are never proposals (owner rule: the ground look is untouchable).

## Use on a new page
1. Copy `bench.html` and `bench.mjs` next to the game's staging page.
2. Make a `main-bench.mjs` copy of the game entry that honours the page contract above (the `__benchRender` hook in the frame loop).
3. `bench.html` loads `./main-bench.mjs`, waits for `__ready`, then imports `./bench.mjs`.
4. Edit the row lists `A` (phase a) and `B` (phase b, old path) in `bench.mjs` for the scene. Each row is `[name, pose, toggle, settle ms]`. `toggle()` applies the change and returns an undo function, which must restore everything it changed.
5. Send the owner one link. They paste back the `#r=` link, which you read with `node decode.mjs '<link>' --md`.

The Zone B copy (2026-10-10) is served from the staging preview as `bench.html`.

A/B identity, run on the box:
`PLAYWRIGHT_MODULE=… node ab-identity.mjs <staging url> <out>` then `python3 ab_sheet.py <out>`.
Pass: mean ≤ 1/255 at every pose (expected 0), and the `nw2` self-check (the new path rendered twice) must be 0, otherwise the capture is not deterministic.
