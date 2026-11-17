# Run 33 round 5

Not a KEEP. Not live. Not merged. Draft stays draft.

Round 4 stays: follow sky-window and crest-stair gates, original canyon mesh, teeth tagged wall, corridor 0, horizon_closed 1/1/1, 9 draws, Bolt x=360.00, card 1.15 m.

## 1. Dark row at t=24.6

The run was a one-pixel wall tooth (mat 6, sun dot 0, ny ≈ 0) between a drift and an arch. The tooth was edge-on, so only its dark lip crossed the frame. The foot is buried and the ends of each range no longer pinch to a knife (envelope floor 0.5). Yaw stays in the spread that does not put a lip back.

`dark-row-gate.mjs` on the chase, t=20 s through t=32 s, 61 frames: all pass. The round-2 fixture still fails.

## 2. Ice CIE76

Still over the bar. Six stills, ice dE76 12.45–13.60 (round 3 was about 6–7, bar 10). The teeth are wall ice, so they count in the ice sample, and most of those pixels have sun dot 0 (wall ndl mean about 0.11 against 0.32 on the round-3 walls). A stronger sunward aim lifted the mean only to 0.16, failed texel stretch at 1.30, and brought the dark lip back. Exposure was not touched. No hand-set colour.

There are 4 native 1024 glacier-ice stills and 4 native 1024 serac stills. Teeth sample the glacier-ice array (the wall family), four variants, hex blend. A per-tooth phase rotates and offsets that lattice. Nothing was upscaled or synthesised.

## 3. Repeat gate

`repeat-gate.mjs`. 2D autocorrelation peak outside a 20 px disc. Fail above 0.31.

| Crop | Peak |
| --- | --- |
| fixture-r4 t=24 | 0.405 fail |
| fixture-r4 t=30 | 0.324 fail |
| round-5 t=24 | 0.574 fail |
| round-5 t=30 | 0.536 fail |

The round-4 crops fail, as required. The new crops do not pass. A single glacier-ice still measures about 0.44 on the same test, so the native photograph already sits above this bar. The large face is still that still, tiled.

## Other gates

| Check | Round 5 | Bar |
| --- | --- | --- |
| corridor hits | 0 | 0 |
| horizon_closed 0 / 0.9 / 1.57 | 1 / 1 / 1 | ≥ 0.98 |
| follow sky-window, six stills | 0.023–0.092 | ≤ 0.12 |
| crest stairs, new t=24 / t=30 | 0 / 0 | < 2 |
| round-3 t=24 / t=30 sky-window | 0.757 / 0.860 | must fail |
| CPU / page triangles | 196234 / 196866 | ≤ 197000 CPU |
| draws | 9 | ≤ 12 |
| texel | PASS, glacier-ice stretch 1.30 | ≤ 1.3, 2048 px/m |
| 11.70 s snow p50 delta | 0.0508 | 0.05, not tuned |
| keyscore | 91.22 | ≥ 85.84 |

`chase.mp4` is 720×1280, 61 frames, 12.2 s, 5 fps, t=20 s through t=32 s. Bolt mean x is 360.00.

Before: `artifacts/run32-hdr/before/` and `fixture-r3/`. Round-4 crops: `fixture-r4/`. 3× crops: `crops/t24-ice-3x.jpg`, `crops/t30-ice-3x.jpg`.

No KEEP.
