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
2. Full 360° turn, stills every 45°, horizon samples every 10°.
3. Walk to the first gate until the path trigger or a stop.
4. Walk outward on 8 headings (every 45°, skipping the gate opening) until a collider stops the hero, then wait for idle.
5. Walk up to each `interior_objects` entry.
6. Gallop, then stop and wait for idle.

Input is `window.__play` (`setInput`, `tick`, `look`, `reset`). Keyboard (WASD / arrows) and the on-screen stick are the human path. The hook is required for the scripted walk.

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
      objectIds: { width, height, labels, b64 }
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
| `stops_visible` | A stop is not in contact with a layout surface (blocked, or within 0.5 m), or nothing from the layout covers the view ahead. Flat black and pixels that match unlabeled ground do not count. |
| `collider_eq_visual` | Stop is more than 0.5 m from a layout surface, or the surface is not visible. |
| `layout_rendered` | A hull, gate, or interior that the walk faced never wrote visible pixels. |
| `ring_closed` | A 1° data ray misses outside the gate span, or a 10° heading from the centre shows no edge pixels. |
| `gate` | Gate frame not visible at its heading, HUD bearing/distance off, or the opening never sets `pathTrigger`. |
| `near_lens` | `nearestVisibleM` missing or inside `near_lens.cull_m`. |
| `fog_band` | Fewer than 20 patches in the file, or fog pixels missing / hard-edged. |
| `black_regions` | A large flat near-black rectangle. A full-width night-sky band that touches the top is ignored. |
| `tile_repeat` | Obvious periodic repetition on the ground band. |
| `backdrop_res` | On-screen ring pixels exceed the source pixels of that slice (`screen / (source × fov/360)`, and sky height / source height). |
| `single_hero` / `single_bolt` | Not exactly one `hero` blob, or idle and gallop were not both captured. |
| `idle_gallop_switch` | Moving frame is not `GALLOP`, or the stop frame is not `IDLE` at about speed 0. |
| `fullscreen` | Canvas or screenshot is not 720×1600. |
| `debug_hook` | `snapshot()` or the ID buffer is missing. |

## Honest limits

- `black_regions`, `tile_repeat`, and the fog streak test are **heuristics**.
- Outward stops are **8 headings** (every 45°), not 36 separate walks. Horizon coverage is **36 headings** (every 10°) from the centre during the turn. `ring_closed` / `stops_visible` / `collider_eq_visual` are marked partial for that reason.
- `backdrop_res` and `mag` use sizes and the HUD number the renderer reports on the live hook. The colour cross-check rejects an ID buffer whose pixels are empty ground or flat black. A hook that lies about both the sizes and the pixels can still fool a row. The screenshots are the proof a person can look at.
- `near_lens` is the renderer's nearest fragment distance, required on every frame. It is not a second depth buffer inside this tool.
- The committed samples under `sample/` are runs of `fixture/`, because this repo has no clearing play build. `sample/clean` is the harness with objects drawn. `sample/take8` reproduces invisible stops, a missing gate, an unkeyed black rectangle, a repeated floor, an upscaled ring, magnification above 1, and a real `texSubImage3D` error.

## Tests

```bash
cd tools/playcheck && npm test
```
