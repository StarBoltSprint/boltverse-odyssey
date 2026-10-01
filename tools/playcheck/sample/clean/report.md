# playcheck

Result: **PASS** (19 pass, 0 fail)

URL: `http://127.0.0.1:46549/index.html?fixture=clean&debug=1`

Layout: `/workspace/tools/playcheck/fixture/clearing.json` (`sample-zone`)

Viewport: 360×800 CSS, device pixel ratio 2, framebuffer 720×1600, full screen.

Video: `/workspace/tools/playcheck/sample/clean/walk.mp4` (720×1600, 30 fps, 55.7s, 6856336 bytes)

This file is the validator's report. A hand-written PASS table is not this report.

| row | result | numbers |
| --- | --- | --- |
| webgl_errors | PASS | count=0 |
| webgl_clean | PASS | count=0 |
| mag_max | PASS | mag_max=0.937, at=01-spawn, limit=1, missing=0 |
| mag | PASS | mag_max=0.937, at=01-spawn, limit=1, missing=0 |
| stops_visible | PASS | stops=8, invisible=0 _(partial)_ |
| collider_eq_visual | PASS | tolerance_m=0.5, stops=8, bad=0 _(partial)_ |
| layout_rendered | PASS | objects=11 _(partial)_ |
| ring_closed | PASS | dataHits=347, dataMissCount=0, gateSkip=13, renderHeadings=36, renderMiss=0 |
| gate | PASS | id=to-path, pixels=693, color=drawn, bearing_deg=0, dist_m=18, layoutDist=18 |
| near_lens | PASS | cull_m=1.2, nearest_m=1.41, at=03-gate-end, missing=0, samples=58 _(heuristic, partial)_ |
| fog_band | PASS | patches=32, fogPixels=191527, colored=true, streakFrac=0, streakSamples=200 _(heuristic, partial)_ |
| black_regions | PASS | hitCount=0, skyBandsIgnored=0, scanned=22 _(heuristic)_ |
| tile_repeat | PASS | scanned=18, worstPeak=0.681, worstLag=111, worstAt=04-stop-225 _(heuristic)_ |
| backdrop_res | PASS | mag=0.937, magW=0.937, magH=0.656, slice=768.432, sourceW=8192, sourceH=1024 _(partial)_ |
| single_hero | PASS | frames=58, heroCount=1, blobs=1 |
| single_bolt | PASS | single_hero=PASS, idle_gallop_switch=PASS |
| idle_gallop_switch | PASS |  |
| fullscreen | PASS | width=720, height=1600, frames=58 |
| debug_hook | PASS | frames=58 |

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

Peak magnification 0.937 at 01-spawn, limit 1.

```json
{
  "mag_max": 0.937,
  "at": "01-spawn",
  "limit": 1,
  "missing": 0
}
```

### mag — PASS

Doc 63 name for the same HUD magnification peak as mag_max. Above the layout limit is FAIL.

```json
{
  "mag_max": 0.937,
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
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 1,
      "pixels": 8976,
      "label": "edge-0",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 21.925,
        "groundDiff": 59.383,
        "meanL": 97.35,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-045",
      "heading": 45,
      "dist": 5.52,
      "gap": 0.351,
      "blocked": true,
      "contact": true,
      "frac": 0.499,
      "pixels": 4482,
      "label": "interior-0",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 0,
        "groundDiff": 53.444,
        "meanL": 95.429,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-090",
      "heading": 90,
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 1,
      "pixels": 8976,
      "label": "edge-1",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 24.729,
        "groundDiff": 23.236,
        "meanL": 121.766,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-135",
      "heading": 135,
      "dist": 17.634,
      "gap": 0.366,
      "blocked": true,
      "contact": true,
      "frac": 1,
      "pixels": 8976,
      "label": "edge-2",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 19.233,
        "groundDiff": 43.597,
        "meanL": 98.609,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-180",
      "heading": 180,
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 1,
      "pixels": 8976,
      "label": "edge-3",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 25.057,
        "groundDiff": 44.8,
        "meanL": 115.323,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-225",
      "heading": 225,
      "dist": 17.634,
      "gap": 0.366,
      "blocked": true,
      "contact": true,
      "frac": 1,
      "pixels": 8976,
      "label": "edge-4",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 18.97,
        "groundDiff": 36.886,
        "meanL": 88.11,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-270",
      "heading": 270,
      "dist": 17.633,
      "gap": 0.367,
      "blocked": true,
      "contact": true,
      "frac": 1,
      "pixels": 8976,
      "label": "edge-5",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 17.844,
        "groundDiff": 47.003,
        "meanL": 122.855,
        "reason": "drawn"
      },
      "covered": true
    },
    {
      "id": "04-stop-315",
      "heading": 315,
      "dist": 17.634,
      "gap": 0.366,
      "blocked": true,
      "contact": true,
      "frac": 1,
      "pixels": 8976,
      "label": "edge-6",
      "color": {
        "visible": true,
        "samples": 80,
        "std": 14.635,
        "groundDiff": 48.417,
        "meanL": 140.316,
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
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-045",
      "heading": 45,
      "dist": 5.52,
      "gap": 0.351,
      "surface": "interior-0",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-090",
      "heading": 90,
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-135",
      "heading": 135,
      "dist": 17.634,
      "gap": 0.366,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-180",
      "heading": 180,
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-225",
      "heading": 225,
      "dist": 17.634,
      "gap": 0.366,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-270",
      "heading": 270,
      "dist": 17.633,
      "gap": 0.367,
      "surface": "edge_ring",
      "near": true,
      "visible": true
    },
    {
      "id": "04-stop-315",
      "heading": 315,
      "dist": 17.634,
      "gap": 0.366,
      "surface": "edge_ring",
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
  "objects": 11,
  "missing": [],
  "rows": [
    {
      "id": "edge-0",
      "kind": "edge",
      "facing": 7,
      "saw": true
    },
    {
      "id": "edge-1",
      "kind": "edge",
      "facing": 8,
      "saw": true
    },
    {
      "id": "edge-2",
      "kind": "edge",
      "facing": 8,
      "saw": true
    },
    {
      "id": "edge-3",
      "kind": "edge",
      "facing": 7,
      "saw": true
    },
    {
      "id": "edge-4",
      "kind": "edge",
      "facing": 8,
      "saw": true
    },
    {
      "id": "edge-5",
      "kind": "edge",
      "facing": 8,
      "saw": true
    },
    {
      "id": "edge-6",
      "kind": "edge",
      "facing": 7,
      "saw": true
    },
    {
      "id": "edge-7",
      "kind": "edge",
      "facing": 6,
      "saw": true
    },
    {
      "id": "gate:to-path",
      "kind": "gate",
      "facing": 6,
      "saw": true
    },
    {
      "id": "interior-0",
      "kind": "interior",
      "facing": 1,
      "saw": true
    },
    {
      "id": "interior-1",
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
  "dataHits": 347,
  "dataMisses": [],
  "dataMissCount": 0,
  "gateSkip": 13,
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
  "pixels": 693,
  "color": "drawn",
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
  "nearest_m": 1.41,
  "at": "03-gate-end",
  "missing": 0,
  "samples": 58
}
```

### fog_band — PASS

Fog must be in the file (20+ patches) and in the picture. Hard streak edges are a heuristic FAIL.

```json
{
  "patches": 32,
  "fogPixels": 191527,
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
  "scanned": 22
}
```

### tile_repeat — PASS

Autocorrelation on the ground band. Obvious tile or checker repetition is FAIL. A smooth gradient is not. Heuristic.

```json
{
  "scanned": 18,
  "worstPeak": 0.681,
  "worstLag": 111,
  "worstAt": "04-stop-225",
  "flagged": []
}
```

### backdrop_res — PASS

Backdrop magnification is on-screen pixels divided by the source pixels of the visible ring slice (and by source height). Above 1.0 is an upscale, FAIL. The sizes come from the live renderer, not from a hand-written table.

```json
{
  "mag": 0.937,
  "magW": 0.937,
  "magH": 0.656,
  "slice": 768.432,
  "sourceW": 8192,
  "sourceH": 1024,
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
