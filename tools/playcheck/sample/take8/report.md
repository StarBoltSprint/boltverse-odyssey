# playcheck

Result: **FAIL** (6 pass, 13 fail)

URL: `http://127.0.0.1:40991/index.html?fixture=take8&debug=1`

Layout: `/workspace/tools/playcheck/fixture/clearing.json` (`sample-zone`)

Viewport: 360×800 CSS, device pixel ratio 2, framebuffer 720×1600, full screen.

Video: `/workspace/tools/playcheck/sample/take8/walk.mp4` (720×1600, 30 fps, 55.7s, 10197776 bytes)

This file is the validator's report. A hand-written PASS table is not this report.

| row | result | numbers |
| --- | --- | --- |
| webgl_errors | FAIL | count=2 |
| webgl_clean | FAIL | count=2 |
| mag_max | FAIL | mag_max=14.992, at=01-spawn, limit=1, missing=0 |
| mag | FAIL | mag_max=14.992, at=01-spawn, limit=1, missing=0 |
| stops_visible | FAIL | stops=8, invisible=8 _(partial)_ |
| collider_eq_visual | FAIL | tolerance_m=0.5, stops=8, bad=8 _(partial)_ |
| layout_rendered | FAIL | objects=11 _(partial)_ |
| ring_closed | FAIL | dataHits=347, dataMissCount=0, gateSkip=13, renderHeadings=36, renderMiss=35 |
| gate | FAIL | id=to-path, pixels=0, color=too-few-pixels, bearing_deg=0, dist_m=18, layoutDist=18 |
| near_lens | PASS | cull_m=1.2, nearest_m=80, at=01-spawn, missing=0, samples=58 _(heuristic, partial)_ |
| fog_band | FAIL | patches=32, fogPixels=0, colored=false, streakFrac=0, streakSamples=0 _(heuristic, partial)_ |
| black_regions | FAIL | hitCount=22, skyBandsIgnored=0, scanned=22 _(heuristic)_ |
| tile_repeat | FAIL | scanned=18, worstPeak=1, worstLag=110, worstAt=02-turn-270 _(heuristic)_ |
| backdrop_res | FAIL | mag=14.992, magW=14.992, magH=7, slice=48.027, sourceW=512, sourceH=96 _(partial)_ |
| single_hero | PASS | frames=58, heroCount=1, blobs=1 |
| single_bolt | PASS | single_hero=PASS, idle_gallop_switch=PASS |
| idle_gallop_switch | PASS |  |
| fullscreen | PASS | width=720, height=1600, frames=58 |
| debug_hook | PASS | frames=58 |

## Detail

### webgl_errors — FAIL

Any WebGL error is FAIL, including texSubImage3D INVALID_OPERATION / INVALID_VALUE.

```json
{
  "count": 2,
  "errors": [
    "WebGL texSubImage3D INVALID_VALUE",
    "[.WebGL-0x1054000f3600] GL_INVALID_VALUE: glTexSubImage3DRobustANGLE: Offset overflows texture dimensions."
  ]
}
```

### webgl_clean — FAIL

Doc 63 name for the same WebGL capture as webgl_errors.

```json
{
  "count": 2
}
```

### mag_max — FAIL

Peak magnification 14.992 at 01-spawn, limit 1. Above 1.0 is FAIL.

```json
{
  "mag_max": 14.992,
  "at": "01-spawn",
  "limit": 1,
  "missing": 0
}
```

### mag — FAIL

Doc 63 name for the same HUD magnification peak as mag_max. Above the layout limit is FAIL.

```json
{
  "mag_max": 14.992,
  "at": "01-spawn",
  "limit": 1,
  "missing": 0
}
```

### stops_visible — FAIL

A stop with nothing visible ahead is FAIL (invisible collider).

```json
{
  "stops": 8,
  "invisible": 8,
  "rows": [
    {
      "id": "04-stop-000",
      "heading": 0,
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    },
    {
      "id": "04-stop-045",
      "heading": 45,
      "dist": 5.52,
      "gap": 0.351,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    },
    {
      "id": "04-stop-090",
      "heading": 90,
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    },
    {
      "id": "04-stop-135",
      "heading": 135,
      "dist": 17.634,
      "gap": 0.366,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    },
    {
      "id": "04-stop-180",
      "heading": 180,
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    },
    {
      "id": "04-stop-225",
      "heading": 225,
      "dist": 17.634,
      "gap": 0.366,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    },
    {
      "id": "04-stop-270",
      "heading": 270,
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    },
    {
      "id": "04-stop-315",
      "heading": 315,
      "dist": 17.634,
      "gap": 0.366,
      "blocked": true,
      "contact": true,
      "frac": 0,
      "pixels": 0,
      "label": null,
      "color": {
        "visible": false,
        "reason": "no-label"
      },
      "covered": false
    }
  ]
}
```

### collider_eq_visual — FAIL

Stop must be within 0.5 m of a layout surface AND that surface must be visible. Data distance without pixels is FAIL.

```json
{
  "tolerance_m": 0.5,
  "stops": 8,
  "bad": 8,
  "rows": [
    {
      "id": "04-stop-000",
      "heading": 0,
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": false
    },
    {
      "id": "04-stop-045",
      "heading": 45,
      "dist": 5.52,
      "gap": 0.351,
      "surface": "interior-0",
      "near": true,
      "visible": false
    },
    {
      "id": "04-stop-090",
      "heading": 90,
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": false
    },
    {
      "id": "04-stop-135",
      "heading": 135,
      "dist": 17.634,
      "gap": 0.366,
      "surface": "edge_ring",
      "near": true,
      "visible": false
    },
    {
      "id": "04-stop-180",
      "heading": 180,
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": false
    },
    {
      "id": "04-stop-225",
      "heading": 225,
      "dist": 17.634,
      "gap": 0.366,
      "surface": "edge_ring",
      "near": true,
      "visible": false
    },
    {
      "id": "04-stop-270",
      "heading": 270,
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": false
    },
    {
      "id": "04-stop-315",
      "heading": 315,
      "dist": 17.634,
      "gap": 0.366,
      "surface": "edge_ring",
      "near": true,
      "visible": false
    }
  ]
}
```

### layout_rendered — FAIL

An object that was in view and wrote no visible pixels is absent, even if it is in the layout file.

```json
{
  "objects": 11,
  "missing": [
    "edge-0",
    "edge-1",
    "edge-2",
    "edge-3",
    "edge-4",
    "edge-5",
    "edge-6",
    "edge-7",
    "gate:to-path",
    "interior-0",
    "interior-1"
  ],
  "rows": [
    {
      "id": "edge-0",
      "kind": "edge",
      "facing": 7,
      "saw": false
    },
    {
      "id": "edge-1",
      "kind": "edge",
      "facing": 8,
      "saw": false
    },
    {
      "id": "edge-2",
      "kind": "edge",
      "facing": 8,
      "saw": false
    },
    {
      "id": "edge-3",
      "kind": "edge",
      "facing": 7,
      "saw": false
    },
    {
      "id": "edge-4",
      "kind": "edge",
      "facing": 8,
      "saw": false
    },
    {
      "id": "edge-5",
      "kind": "edge",
      "facing": 8,
      "saw": false
    },
    {
      "id": "edge-6",
      "kind": "edge",
      "facing": 7,
      "saw": false
    },
    {
      "id": "edge-7",
      "kind": "edge",
      "facing": 6,
      "saw": false
    },
    {
      "id": "gate:to-path",
      "kind": "gate",
      "facing": 6,
      "saw": false
    },
    {
      "id": "interior-0",
      "kind": "interior",
      "facing": 1,
      "saw": false
    },
    {
      "id": "interior-1",
      "kind": "interior",
      "facing": 1,
      "saw": false
    }
  ]
}
```

### ring_closed — FAIL

Data rays and the 36 rendered headings both have to close. A collider ring with no pixels is FAIL. Gate span is the allowed opening.

```json
{
  "dataHits": 347,
  "dataMisses": [],
  "dataMissCount": 0,
  "gateSkip": 13,
  "renderHeadings": 36,
  "renderMiss": 35,
  "renderMissDeg": [
    0,
    10,
    20,
    30,
    40,
    50,
    60,
    70,
    80,
    90,
    100,
    110
  ]
}
```

### gate — FAIL

The gate frame must be visible from the centre, the HUD bearing and distance must match, and walking the opening must hit the path trigger.

```json
{
  "id": "to-path",
  "pixels": 0,
  "color": "too-few-pixels",
  "bearing_deg": 0,
  "dist_m": 18,
  "layoutDist": 18,
  "pathTrigger": true
}
```

### near_lens — PASS

Nearest non-hero fragment that passed alpha must stay outside near_lens.cull_m. Partial: the distance is the renderer’s fragment metric, cross-checked only by being present on every frame.

```json
{
  "cull_m": 1.2,
  "nearest_m": 80,
  "at": "01-spawn",
  "missing": 0,
  "samples": 58
}
```

### fog_band — FAIL

Fog must be in the file (20+ patches) and in the picture. Hard streak edges are a heuristic FAIL.

```json
{
  "patches": 32,
  "fogPixels": 0,
  "colored": false,
  "streakFrac": 0,
  "streakSamples": 0
}
```

### black_regions — FAIL

Large flat near-black rectangles are FAIL. A full-width night-sky band that touches the top is ignored. Heuristic.

```json
{
  "hits": [
    {
      "id": "01-spawn",
      "areaFrac": 0.046,
      "fill": 1,
      "x": 264,
      "y": 400,
      "w": 176,
      "h": 304
    },
    {
      "id": "02-turn-270",
      "areaFrac": 0.046,
      "fill": 1,
      "x": 264,
      "y": 400,
      "w": 176,
      "h": 304
    },
    {
      "id": "02-turn-315",
      "areaFrac": 0.046,
      "fill": 1,
      "x": 264,
      "y": 400,
      "w": 176,
      "h": 304
    },
    {
      "id": "02-turn-045",
      "areaFrac": 0.046,
      "fill": 1,
      "x": 264,
      "y": 400,
      "w": 176,
      "h": 304
    },
    {
      "id": "02-turn-090",
      "areaFrac": 0.046,
      "fill": 1,
      "x": 264,
      "y": 400,
      "w": 176,
      "h": 304
    },
    {
      "id": "02-turn-135",
      "areaFrac": 0.046,
      "fill": 1,
      "x": 264,
      "y": 400,
      "w": 176,
      "h": 304
    }
  ],
  "hitCount": 22,
  "skyBandsIgnored": 0,
  "scanned": 22
}
```

### tile_repeat — FAIL

Autocorrelation on the ground band. Obvious tile or checker repetition is FAIL. A smooth gradient is not. Heuristic.

```json
{
  "scanned": 18,
  "worstPeak": 1,
  "worstLag": 110,
  "worstAt": "02-turn-270",
  "flagged": [
    {
      "id": "02-turn-270",
      "peak": 1,
      "lag": 110,
      "prominence": 0.923
    },
    {
      "id": "02-turn-090",
      "peak": 1,
      "lag": 110,
      "prominence": 0.947
    },
    {
      "id": "02-turn-180",
      "peak": 1,
      "lag": 110,
      "prominence": 0.913
    },
    {
      "id": "04-stop-000",
      "peak": 1,
      "lag": 109,
      "prominence": 0.945
    }
  ]
}
```

### backdrop_res — FAIL

Backdrop magnification is on-screen pixels divided by the source pixels of the visible ring slice (and by source height). Above 1.0 is an upscale, FAIL. The sizes come from the live renderer, not from a hand-written table.

```json
{
  "mag": 14.992,
  "magW": 14.992,
  "magH": 7,
  "slice": 48.027,
  "sourceW": 512,
  "sourceH": 96,
  "screenW": 720,
  "screenH": 672,
  "fovDeg": 33.769,
  "at": "01-spawn",
  "missing": 0
}
```

### single_hero — PASS

One hero on every captured frame.

```json
{
  "frames": 58,
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
    "spd": 6.2
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
  "frames": 58
}
```

### debug_hook — PASS

snapshot() and object-ID buffer present on every captured step.

```json
{
  "frames": 58,
  "labels": [
    "",
    "edge-0",
    "edge-1",
    "edge-2",
    "edge-3",
    "edge-4",
    "edge-5",
    "edge-6",
    "edge-7",
    "interior-0",
    "interior-1",
    "gate:to-path",
    "fog",
    "hero"
  ]
}
```

## Notes

- This URL is the playcheck fixture harness, not a biome play build. This repo has no clearing play build. The harness paints test patterns so the tool can run here. It is not a style and it does not change a game.
- Heuristic rows: black_regions, tile_repeat, fog_band streak test. Partial rows: stops are every 45° (8 headings) rather than 36 walked headings; ring coverage is sampled every 10° from the centre; backdrop size is reported by the renderer; near_lens uses the renderer's nearest fragment distance. A data-only agreement is not a PASS.

## Stills

- `stills/01-spawn.png`
- `stills/02-turn-270.png`
- `stills/02-turn-315.png`
- `stills/02-turn-045.png`
- `stills/02-turn-090.png`
- `stills/02-turn-135.png`
- `stills/02-turn-180.png`
- `stills/02-turn-225.png`
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
- `stills/05-interior-0.png`
- `stills/05-interior-1.png`
- `stills/06-gallop.png`
- `stills/07-idle.png`
