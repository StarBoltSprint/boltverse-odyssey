# playcheck

Result: **PASS** (27 pass, 0 fail)

URL: `http://127.0.0.1:8080/packs/zone-a/play/index.html?debug=1`

Layout: `/workspace/odyssey/packs/zone-a/clearing.json` (`zone-a`)

Viewport: 360×800 CSS, device pixel ratio 2, framebuffer 720×1600, full screen.

Video: `/workspace/odyssey/packs/zone-a/proof/playcheck/walk.mp4` (720×1600, 30 fps, 73.7s, 13628485 bytes)

This file is the validator's report. A hand-written PASS table is not this report.

| row | result | numbers |
| --- | --- | --- |
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.941, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.941, at=01-spawn, limit=1, missing=0 |
| stops_visible | PASS | stops=8, invisible=0 _(partial)_ |
| collider_eq_visual | PASS | tolerance_m=0.5, stops=8, bad=0 _(partial)_ |
| layout_rendered | PASS | objects=57 _(partial)_ |
| ring_closed | PASS | dataHits=345, dataMissCount=0, gateSkip=15, renderHeadings=36, renderMiss=0 |
| gate | PASS | id=to-path, pixels=25495, color=drawn, bearing_deg=0, dist_m=15.72, layoutDist=18 |
| near_lens | PASS | cull_m=1.2, nearest_m=2.68, at=01-spawn, missing=0, samples=67 _(heuristic, partial)_ |
| fog_band | PASS | patches=28, fogPixels=433282, colored=true, streakFrac=0, streakSamples=200 _(heuristic, partial)_ |
| black_regions | PASS | hitCount=0, skyBandsIgnored=0, scanned=31 _(heuristic)_ |
| tile_repeat | PASS | scanned=18, worstPeak=0.966, worstLag=4, worstAt=04-stop-225 _(heuristic)_ |
| backdrop_res | PASS | mag=0.894, magW=0.894, magH=0.877, slice=805.093, sourceW=12768, sourceH=912 _(partial)_ |
| single_hero | PASS | frames=67, heroCount=1, blobs=1 |
| single_bolt | PASS | single_hero=PASS, idle_gallop_switch=PASS |
| idle_gallop_switch | PASS |  |
| fullscreen | PASS | width=720, height=1600, frames=67 |
| debug_hook | PASS | frames=67 |
| fps_avg | PASS | fpsAvg=29.99999999999998, min=30, samples=67 |
| fps_1low | PASS | fps1Low=29.999999999999996, min=20, samples=67 |
| frame_ms | PASS | frameMsAvg=33.33333333333336, frameMs=33.333333333333336, max=33.333 |
| js_heap | PASS | heapBytes=null, max=402653184, available=false _(partial)_ |
| texture_mem | PASS | textureBytes=204790784, max=268435456 |
| video_decoders | PASS | videoDecoders=3, max=6 |
| draw_calls | PASS | drawCalls=24, max=150 |
| bolt_grounded | PASS | frames=67, bad=0 |

## Detail

### webgl_errors — PASS

No WebGL errors from gl.getError or the console during the walk.

```json
{
  "count": 0
}
```

### webgl_clean — PASS

Doc 63 name for the same WebGL capture as webgl_errors.

```json
{
  "count": 0
}
```

### mag_max — PASS

Peak magnification 0.9407600596125186 at 01-spawn, limit 1.

```json
{
  "mag_max": 0.941,
  "at": "01-spawn",
  "limit": 1,
  "missing": 0
}
```

### mag — PASS

Doc 63 name for the same HUD magnification peak as mag_max. Above the layout limit is FAIL.

```json
{
  "mag_max": 0.941,
  "at": "01-spawn",
  "limit": 1,
  "missing": 0
}
```

### stops_visible — PASS

Every stop has a layout object covering the view ahead, and those pixels are not empty ground or flat black.

```json
{
  "stops": 8,
  "invisible": 0,
  "rows": [
    {
      "id": "04-stop-000",
      "heading": 0,
      "dist": 17.92,
      "gap": 0.08,
      "blocked": false,
      "contact": true,
      "frac": 0.801,
      "pixels": 113271,
      "label": "ring-13",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 41.327,
        "groundDiff": 999,
        "meanL": 93.08,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-045",
      "heading": 45,
      "dist": 17.92,
      "gap": 0.08,
      "blocked": false,
      "contact": true,
      "frac": 0.8,
      "pixels": 113124,
      "label": "ring-19",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 37.511,
        "groundDiff": 999,
        "meanL": 80.316,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-090",
      "heading": 90,
      "dist": 4.117,
      "gap": 0.06,
      "blocked": false,
      "contact": true,
      "frac": 0.418,
      "pixels": 59146,
      "label": "ring-25",
      "color": {
        "visible": true,
        "samples": 19,
        "std": 48.131,
        "groundDiff": 999,
        "meanL": 81.369,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-135",
      "heading": 135,
      "dist": 8.51,
      "gap": 0.06,
      "blocked": false,
      "contact": true,
      "frac": 0.466,
      "pixels": 65949,
      "label": "ring-31",
      "color": {
        "visible": true,
        "samples": 33,
        "std": 34.447,
        "groundDiff": 999,
        "meanL": 70.811,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-180",
      "heading": 180,
      "dist": 7.409,
      "gap": 0.06,
      "blocked": false,
      "contact": true,
      "frac": 0.55,
      "pixels": 77728,
      "label": "hero-00",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 29.964,
        "groundDiff": 999,
        "meanL": 59.501,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-225",
      "heading": 225,
      "dist": 17.92,
      "gap": 0.08,
      "blocked": false,
      "contact": true,
      "frac": 0.757,
      "pixels": 107026,
      "label": "exit-to-path-b",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 35.369,
        "groundDiff": 999,
        "meanL": 76.073,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-270",
      "heading": 270,
      "dist": 7.95,
      "gap": 0.06,
      "blocked": false,
      "contact": true,
      "frac": 0.45,
      "pixels": 63647,
      "label": "ring-02",
      "color": {
        "visible": true,
        "samples": 24,
        "std": 42.393,
        "groundDiff": 999,
        "meanL": 78.936,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-315",
      "heading": 315,
      "dist": 5.681,
      "gap": 0.06,
      "blocked": false,
      "contact": true,
      "frac": 0.503,
      "pixels": 71165,
      "label": "mid-03",
      "color": {
        "visible": true,
        "samples": 24,
        "std": 41.245,
        "groundDiff": 999,
        "meanL": 74.74,
        "reason": "drawn"
      },
      "covered": true
    }
  ]
}
```

### collider_eq_visual — PASS

Stop must be within 0.5 m of a layout surface AND that surface must be visible. Data distance without pixels is FAIL.

```json
{
  "tolerance_m": 0.5,
  "stops": 8,
  "bad": 0,
  "rows": [
    {
      "id": "04-stop-000",
      "heading": 0,
      "dist": 17.92,
      "gap": 0.08,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-045",
      "heading": 45,
      "dist": 17.92,
      "gap": 0.08,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-090",
      "heading": 90,
      "dist": 4.117,
      "gap": 0.06,
      "surface": "near-01",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-135",
      "heading": 135,
      "dist": 8.51,
      "gap": 0.06,
      "surface": "mid-01",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-180",
      "heading": 180,
      "dist": 7.409,
      "gap": 0.06,
      "surface": "hero-00",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-225",
      "heading": 225,
      "dist": 17.92,
      "gap": 0.08,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-270",
      "heading": 270,
      "dist": 7.95,
      "gap": 0.06,
      "surface": "mid-02",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-315",
      "heading": 315,
      "dist": 5.681,
      "gap": 0.06,
      "surface": "near-03",
      "near": true,
      "visible": true
    }
  ]
}
```

### layout_rendered — PASS

Every layout object wrote visible pixels on a frame that faced it.

```json
{
  "objects": 57,
  "missing": [],
  "rows": [
    {
      "id": "ring-00",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-01",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-02",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-03",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-04",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-05",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-06",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-07",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-08",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-09",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-10",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-11",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-12",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-13",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-14",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-15",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-16",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-17",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-18",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-19",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-20",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-21",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-22",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-23",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-24",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-25",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-26",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-27",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-28",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-29",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-30",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-31",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-32",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-33",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-34",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-35",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-36",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-37",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-38",
      "kind": "edge",
      "facing": 5,
      "saw": true
    },
    {
      "id": "ring-39",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "ring-40",
      "kind": "edge",
      "facing": 2,
      "saw": true
    },
    {
      "id": "ring-41",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "ring-42",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "exit-to-path-a",
      "kind": "edge",
      "facing": 3,
      "saw": true
    },
    {
      "id": "exit-to-path-b",
      "kind": "edge",
      "facing": 4,
      "saw": true
    },
    {
      "id": "gate:to-path",
      "kind": "gate",
      "facing": 6,
      "saw": true
    },
    {
      "id": "hero-00",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "mid-00",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "mid-01",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "mid-02",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "mid-03",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "near-00",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "near-01",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "near-02",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "near-03",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "near-04",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "near-05",
      "kind": "interior",
      "facing": 1,
      "saw": true
    }
  ]
}
```

### ring_closed — PASS

Data rays and the 36 rendered headings both have to close. A collider ring with no pixels is FAIL. Gate span is the allowed opening.

```json
{
  "dataHits": 345,
  "dataMisses": [],
  "dataMissCount": 0,
  "gateSkip": 15,
  "renderHeadings": 36,
  "renderMiss": 0,
  "renderMissDeg": []
}
```

### gate — PASS

The gate frame must be visible from the centre, the HUD bearing and distance must match, and walking the opening must hit the path trigger.

```json
{
  "id": "to-path",
  "pixels": 25495,
  "color": "drawn",
  "bearing_deg": 0,
  "dist_m": 15.72,
  "layoutDist": 18,
  "pathTrigger": true
}
```

### near_lens — PASS

Nearest non-hero fragment that passed alpha must stay outside near_lens.cull_m. Partial: the distance is the renderer’s fragment metric, cross-checked only by being present on every frame.

```json
{
  "cull_m": 1.2,
  "nearest_m": 2.68,
  "at": "01-spawn",
  "missing": 0,
  "samples": 67
}
```

### fog_band — PASS

Fog must be in the file (20+ patches) and in the picture. Hard streak edges are a heuristic FAIL.

```json
{
  "patches": 28,
  "fogPixels": 433282,
  "colored": true,
  "streakFrac": 0,
  "streakSamples": 200
}
```

### black_regions — PASS

Large flat near-black rectangles are FAIL. A full-width night-sky band that touches the top is ignored. Heuristic.

```json
{
  "hits": [],
  "hitCount": 0,
  "skyBandsIgnored": 0,
  "scanned": 31
}
```

### tile_repeat — PASS

Autocorrelation on the ground band. Obvious tile or checker repetition is FAIL. A smooth gradient is not. Heuristic.

```json
{
  "scanned": 18,
  "worstPeak": 0.966,
  "worstLag": 4,
  "worstAt": "04-stop-225",
  "flagged": []
}
```

### backdrop_res — PASS

Backdrop magnification is on-screen pixels divided by the source pixels of the visible ring slice (and by source height). Above 1.0 is an upscale, FAIL. The sizes come from the live renderer, not from a hand-written table.

```json
{
  "mag": 0.894,
  "magW": 0.894,
  "magH": 0.877,
  "slice": 805.093,
  "sourceW": 12768,
  "sourceH": 912,
  "screenW": 720,
  "screenH": 800,
  "fovDeg": 22.7,
  "at": "01-spawn",
  "missing": 0
}
```

### single_hero — PASS

One hero on every captured frame.

```json
{
  "frames": 67,
  "heroCount": 1,
  "blobs": 1
}
```

### single_bolt — PASS

Doc 63 single_bolt: one hero in frame, and both idle and gallop captured.

```json
{
  "single_hero": "PASS",
  "idle_gallop_switch": "PASS"
}
```

### idle_gallop_switch — PASS

State is GALLOP while moving and IDLE after the stop.

```json
{
  "gallop": {
    "state": "GALLOP",
    "spd": 4.4
  },
  "idle": {
    "state": "IDLE",
    "spd": 0
  },
  "movingWhileIdle": []
}
```

### fullscreen — PASS

Canvas backing store and screenshots are 720×1600.

```json
{
  "width": 720,
  "height": 1600,
  "frames": 67
}
```

### debug_hook — PASS

snapshot() and object-ID buffer present on every captured step.

```json
{
  "frames": 67,
  "labels": [
    "",
    "hero",
    "ground",
    "fog",
    "ring-00",
    "ring-01",
    "ring-02",
    "ring-03",
    "ring-04",
    "ring-05",
    "ring-06",
    "ring-07",
    "ring-08",
    "ring-09",
    "ring-10",
    "ring-11",
    "ring-12",
    "ring-13",
    "ring-14",
    "ring-15",
    "ring-16",
    "ring-17",
    "ring-18",
    "ring-19",
    "ring-20",
    "ring-21",
    "ring-22",
    "ring-23",
    "ring-24",
    "ring-25",
    "ring-26",
    "ring-27",
    "ring-28",
    "ring-29",
    "ring-30",
    "ring-31",
    "ring-32",
    "ring-33",
    "ring-34",
    "ring-35",
    "ring-36",
    "ring-37",
    "ring-38",
    "ring-39",
    "ring-40",
    "ring-41",
    "ring-42",
    "exit-to-path-a",
    "exit-to-path-b",
    "hero-00",
    "mid-00",
    "mid-01",
    "mid-02",
    "mid-03",
    "near-01",
    "near-02",
    "near-03",
    "near-04",
    "gate:to-path"
  ]
}
```

### fps_avg — PASS

Average FPS is the inverse of the mean present interval over the last 300 frames. A mid-range phone needs at least 30. Within budget.

```json
{
  "fpsAvg": 29.99999999999998,
  "min": 30,
  "samples": 67
}
```

### fps_1low — PASS

1% low is the inverse of the mean of the slowest 1% of those intervals (at least one frame). A mid-range phone needs at least 20. Within budget.

```json
{
  "fps1Low": 29.999999999999996,
  "min": 20,
  "samples": 67
}
```

### frame_ms — PASS

Mean present-frame time must stay at or under 33.333 ms, the same 30 FPS budget. Within budget.

```json
{
  "frameMsAvg": 33.33333333333336,
  "frameMs": 33.333333333333336,
  "max": 33.333
}
```

### js_heap — PASS

performance.memory was not reported. The 384 MiB mid-range tab budget was not measured. A reported heap above that budget is FAIL.

```json
{
  "heapBytes": null,
  "max": 402653184,
  "available": false
}
```

### texture_mem — PASS

Estimated GPU texture memory is the sum of registered textures (width × height × bytes per pixel, one slot per id). Mid-range phone budget is 256 MiB. Within budget.

```json
{
  "textureBytes": 204790784,
  "max": 268435456
}
```

### video_decoders — PASS

Concurrent video decoders (registered ids, or video elements with a source, whichever is larger). Mid-range phone budget is 6. Within budget.

```json
{
  "videoDecoders": 3,
  "max": 6
}
```

### draw_calls — PASS

Peak draw calls in a presented frame. Mid-range phone budget is 150. Instanced fog is one draw. Within budget.

```json
{
  "drawCalls": 24,
  "max": 150
}
```

### bolt_grounded — PASS

Hero bbox is fully on screen, feet are within 5% of the ground, and the sprite quad matches the source aspect.

```json
{
  "frames": 67,
  "bad": 0,
  "rows": []
}
```

## Perf

Additive `perf` object for tools/reportview. Schema `playcheck-perf/1`. Existing row fields are unchanged.

```json
{
  "schema": "playcheck-perf/1",
  "thresholds": {
    "fpsAvgMin": 30,
    "fps1LowMin": 20,
    "frameMsMax": 33.333333333333336,
    "heapBytesMax": 402653184,
    "textureBytesMax": 268435456,
    "videoDecodersMax": 6,
    "drawCallsMax": 150
  },
  "budgetApplied": true,
  "harness": false,
  "aggregate": {
    "fpsAvg": 29.99999999999998,
    "fps1Low": 29.999999999999996,
    "frameMs": 33.333333333333336,
    "frameMsAvg": 33.33333333333336,
    "heapBytes": null,
    "heapAvailable": false,
    "textureBytes": 204790784,
    "videoDecoders": 3,
    "drawCalls": 24,
    "samples": 67
  },
  "samples": [
    {
      "step": "01-spawn",
      "fpsAvg": 29.999999999999996,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "02-turn-180",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "02-turn-225",
      "fpsAvg": 29.999999999999986,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333335,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "02-turn-270",
      "fpsAvg": 30.000000000000004,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "02-turn-315",
      "fpsAvg": 30.000000000000018,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333314,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "02-turn-045",
      "fpsAvg": 30.000000000000025,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333331,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "02-turn-090",
      "fpsAvg": 30.000000000000004,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "02-turn-135",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "03-gate-start",
      "fpsAvg": 29.99999999999997,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333364,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "03-gate-end",
      "fpsAvg": 29.999999999999954,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333385,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "04-stop-000",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "04-stop-045",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 24,
      "scripted": false
    },
    {
      "step": "04-stop-090",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "04-stop-135",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "04-stop-180",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "04-stop-225",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 24,
      "scripted": false
    },
    {
      "step": "04-stop-270",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "04-stop-315",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "05-hero-00",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "05-mid-00",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "05-mid-01",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "05-mid-02",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "05-mid-03",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "05-near-00",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "05-near-01",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "05-near-02",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "05-near-03",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "05-near-04",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "05-near-05",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "06-gallop",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "07-idle",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "ring-start",
      "fpsAvg": 29.999999999999996,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-190",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-200",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-210",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-220",
      "fpsAvg": 29.999999999999986,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333335,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "ring-230",
      "fpsAvg": 29.999999999999986,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333335,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "ring-240",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-250",
      "fpsAvg": 29.999999999999996,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-260",
      "fpsAvg": 29.999999999999996,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-270",
      "fpsAvg": 30.000000000000004,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-280",
      "fpsAvg": 30.000000000000004,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-290",
      "fpsAvg": 30.00000000000001,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333332,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-300",
      "fpsAvg": 30.00000000000001,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333332,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-310",
      "fpsAvg": 30.000000000000018,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333314,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-320",
      "fpsAvg": 30.000000000000018,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333314,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-330",
      "fpsAvg": 30.000000000000018,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333314,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "ring-340",
      "fpsAvg": 30.000000000000025,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333331,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "ring-350",
      "fpsAvg": 30.000000000000025,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333331,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-0",
      "fpsAvg": 30.000000000000025,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333331,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-10",
      "fpsAvg": 30.000000000000025,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333331,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-20",
      "fpsAvg": 30.00000000000003,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.3333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 20,
      "scripted": false
    },
    {
      "step": "ring-30",
      "fpsAvg": 30.00000000000003,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.3333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-40",
      "fpsAvg": 30.000000000000025,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333331,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-50",
      "fpsAvg": 30.000000000000018,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333314,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-60",
      "fpsAvg": 30.000000000000018,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333314,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-70",
      "fpsAvg": 30.00000000000001,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333332,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-80",
      "fpsAvg": 30.000000000000004,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "ring-90",
      "fpsAvg": 30.000000000000004,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333333,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-100",
      "fpsAvg": 29.999999999999996,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-110",
      "fpsAvg": 29.999999999999996,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.333333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-120",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-130",
      "fpsAvg": 29.999999999999993,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333334,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 21,
      "scripted": false
    },
    {
      "step": "ring-140",
      "fpsAvg": 29.999999999999986,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333335,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-150",
      "fpsAvg": 29.999999999999986,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333335,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    },
    {
      "step": "ring-160",
      "fpsAvg": 29.99999999999998,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 23,
      "scripted": false
    },
    {
      "step": "ring-170",
      "fpsAvg": 29.99999999999998,
      "fps1Low": 29.999999999999996,
      "frameMs": 33.333333333333336,
      "frameMsAvg": 33.33333333333336,
      "heapBytes": 0,
      "textureBytes": 204790784,
      "videoDecoders": 3,
      "drawCalls": 22,
      "scripted": false
    }
  ]
}
```

## Notes

- Heuristic rows: black_regions, tile_repeat, fog_band streak test. Partial rows: stops are every 45° (8 headings) rather than 36 walked headings; ring coverage is sampled every 10° from the centre; backdrop size is reported by the renderer; near_lens uses the renderer's nearest fragment distance. A data-only agreement is not a PASS.

## Stills

- `stills/01-spawn.png`
- `stills/02-turn-180.png`
- `stills/02-turn-225.png`
- `stills/02-turn-270.png`
- `stills/02-turn-315.png`
- `stills/02-turn-045.png`
- `stills/02-turn-090.png`
- `stills/02-turn-135.png`
- `stills/03-gate-start.png`
- `stills/03-gate-end.png`
- `stills/04-stop-000.png`
- `stills/04-stop-045.png`
- `stills/04-stop-090.png`
- `stills/04-stop-135.png`
- `stills/04-stop-180.png`
- `stills/04-stop-225.png`
- `stills/04-stop-270.png`
- `stills/04-stop-315.png`
- `stills/05-hero-00.png`
- `stills/05-mid-00.png`
- `stills/05-mid-01.png`
- `stills/05-mid-02.png`
- `stills/05-mid-03.png`
- `stills/05-near-00.png`
- `stills/05-near-01.png`
- `stills/05-near-02.png`
- `stills/05-near-03.png`
- `stills/05-near-04.png`
- `stills/05-near-05.png`
- `stills/06-gallop.png`
- `stills/07-idle.png`
