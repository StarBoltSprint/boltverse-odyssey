# Phone performance counter

A debug overlay and the numbers `tools/playcheck` records. It measures. It does not draw, shade, or colour a world pixel.

## Overlay

`tools/perf/overlay.js` is one classic script. A play view includes it before its own script.

Visible **only** when the URL contains `?perf=1`. Off by default. `?perf=0` and a missing flag leave the page unchanged: no element is added.

The panel is transparent (`background: transparent`), `pointer-events: none`, and pinned to the **top-right** with `max-height: 22vh`. Bottom controls (the stick, the map button) stay uncovered and clickable. It does not sit on the top-left pose HUD.

It shows:

| Line | Meaning |
| --- | --- |
| fps / 1% | Average FPS, and 1% low (mean of the slowest 1% of intervals, at least one frame), over the last 300 present intervals. |
| frame | Last present-frame time, milliseconds. |
| heap | `performance.memory.usedJSHeapSize` when the browser exposes it. |
| tex | Estimated GPU texture memory. Sum of `noteTexture` slots (one size per id, replaced on update). |
| decoders | Registered video ids, or `<video>` elements that have a source, whichever is larger. |
| draws | Last `noteDraw` count for the presented frame. |

## API

`window.__perf` is installed even when the panel is hidden, so a validator can read it.

```js
__perf.noteFrame({ dtMs, workMs })  // one presented frame; dtMs is the interval
__perf.notePresent(ms)              // interval only (the overlay does not call this itself)
__perf.noteDraw(count)              // draws in that frame, not a running total
__perf.noteTexture(id, bytes)       // RGBA bytes ≈ width * height * 4
__perf.releaseTexture(id)
__perf.noteVideo(id)
__perf.releaseVideo(id)
__perf.snapshot()
```

Call `noteFrame` once per presented frame from the play loop. The first call marks the sample `scripted: true` and the overlay does not invent a second clock. A device build that renders from `requestAnimationFrame` should pass that callback's delta as `dtMs`.

`snapshot().perf` on `window.__play` should be this object (see `tools/playcheck`).

## Mid-range phone budget

These are the playcheck thresholds for a mid-range phone. Frame-time rows (`fps_avg`, `fps_1low`, `frame_ms`) are informational when the run is SwiftShader. They are not retuned for a desktop.

| Row | PASS |
| --- | --- |
| `fps_avg` | average FPS ≥ **30** |
| `fps_1low` | 1% low ≥ **20** |
| `frame_ms` | mean present interval ≤ **33.333 ms** |
| `js_heap` | `usedJSHeapSize` ≤ **384 MiB** (402653184 bytes). If the browser does not expose `performance.memory`, the row is PASS, `available: false`, partial. A reported heap over the cap is FAIL. |
| `texture_mem` | estimated texture bytes ≤ **256 MiB** (268435456). |
| `video_decoders` | concurrent decoders ≤ **6**. |
| `active_videos` | concurrent decoders ≤ **4** (law 65). The wider `video_decoders` row stays. |
| `draw_calls` | peak draws in a frame ≤ **150**. |
| `perf_line` | `drawCalls`, `texMB` (texture bytes ÷ 1024²), `activeVideos`, and `jsMs` are all present. |

`fps_avg`, `fps_1low`, and `frame_ms` stay in the report. When playcheck runs on SwiftShader they are informational and do not fail the take. A missing `snapshot().perf` is still FAIL. Law: [`biome/docs/65-render-quality.md`](../../biome/docs/65-render-quality.md).

The measurement fixture (`snap.harness === true`, `tools/playcheck/fixture`) records the same numbers and does **not** apply this budget, so the existing fixture exit code stays what the other rows decide. A real play URL is not the harness. Missing `snapshot().perf` on a real play URL is FAIL.

## reportview

`tools/playcheck` `report.json` gains one additive object. Existing keys are unchanged.

```json
"perf": {
  "schema": "playcheck-perf/1",
  "thresholds": {
    "fpsAvgMin": 30,
    "fps1LowMin": 20,
    "frameMsMax": 33.333,
    "heapBytesMax": 402653184,
    "textureBytesMax": 268435456,
    "videoDecodersMax": 6,
    "activeVideosMax": 4,
    "drawCallsMax": 150
  },
  "budgetApplied": true,
  "harness": false,
  "aggregate": {
    "fpsAvg": 0,
    "fps1Low": 0,
    "frameMs": 0,
    "frameMsAvg": 0,
    "heapBytes": 0,
    "heapAvailable": true,
    "textureBytes": 0,
    "videoDecoders": 0,
    "drawCalls": 0,
    "samples": 0
  },
  "samples": [
    {
      "step": "01-spawn",
      "fpsAvg": 0,
      "fps1Low": 0,
      "frameMs": 0,
      "frameMsAvg": 0,
      "heapBytes": 0,
      "textureBytes": 0,
      "videoDecoders": 0,
      "drawCalls": 0,
      "scripted": true
    }
  ]
}
```

Row ids added after the existing set: `fps_avg`, `fps_1low`, `frame_ms`, `js_heap`, `texture_mem`, `video_decoders`, `draw_calls`. Each row is still `{ id, result, numbers, detail, heuristic, partial }`.

## Honest limits

- The counter trusts `noteTexture` / `noteDraw` / `noteFrame`. It does not scan the GPU. A play view that forgets a texture under-reports memory.
- 1% low on a short walk is one or two frames. A single hitch dominates.
- `scripted: true` means the page called `noteFrame` (playcheck's `tick(dt)` path). That interval is the interval the page recorded. It is not a second measurement taken outside the process.
- JS heap is missing in browsers that do not implement `performance.memory`. That row does not invent a number.
- The overlay text is debug chrome. It is not an Imagine pixel and not a world shadow.

## Self-test

```bash
node tools/perf/selftest.mjs
cd tools/playcheck && npm test
```
