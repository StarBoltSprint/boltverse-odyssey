# D9 gates

Written before the trial. Thresholds are not lowered.

The fixture is the run-31 capture (`artifacts/run31/frames/t10.jpg`, `t24.jpg`, `t30.jpg`). Each frame must fail the terminator gate and the banding gate. That result is `fixture-before.json`.

Measured on the real 720×1280 follow camera, same seed and route.

| Gate | Pass |
| --- | --- |
| Terminator angle | within ±15 deg of scene sun `[0.6161, 0.5592, 0.5547]`, elevation 34 deg, at 5.10, 5.567, 7.9, 11.70, 24, and 30 s. The heading is the luma gradient on the analytic N·L ≈ 0 band. If under 30% of that arc is visible, the heading is N/A |
| Terminator present | brightness gradient on the disc at least 0.04 luma per pixel, 400 planet pixels |
| Radial profile | lit half exceeds the unlit half by 8 luma; outer ring (rho 0.88–0.96) exceeds the pre-rim ring by 4; the four rings span at least 8 |
| Sky 8-bit step | 90th percentile of the step between level runs of at least 3 rows, in the clear top band ≤ 1. A one-row spike is not a band |
| Visible band | median constant-code run in that band ≤ 10 rows |
| Dither grain | high-frequency RMS of the sky crop ≤ 2.5 levels above a 5×5 mean. The 5×5 field against an 11×11 mean is the smooth reference |
| Sky anchor | world-direction spread ≤ 0.015, the existing limit |
| Sky preserved | sky fraction ≥ 0.9× the key, skyline row within 3 px, planet centre within 4 px and radius within 3% |
| Colour | CIE76 ≤ 10 including lightness, sky and planet, against the rig key. No hue-only check |
| Bolt | card height 1.15 m, follow view centred at x = 360, same as the key frame within 2 px |
| Budget | ≤ 200,000 triangles and ≤ 12 draws. Both reported |
| Texel | `biome-factory/texel-gate.mjs` at 2048 px/m. Not overridden |
| Sun vector | the scene sun above is used and not edited. `dawn-light.json` is not edited |

Scene sun is world-locked. The planet plate stays the existing 1024×1024 Imagine still. A new plate at or above 2560 px is not cooked.

## Round 3

The bright outer-ring clause (rho 0.88–0.96 at least 4 luma above the pre-rim) is the wide night haze. It is replaced, not lowered. The lit-half gap of 8 and the ring span of 8 stay. The new limb gates were written against the round-2 stills first. Those six frames fail (`r2-limb-gate.json`).

| Gate | Pass |
| --- | --- |
| Near-white | 0 planet pixels with every channel ≥ 235, disc and rim, at all six times |
| Rim width | 10%–90% of the night-side luma rise ≤ 6% of the radius |
| Dark limb | dark-limb luma < adjacent sky − 20 |
| Sun limb | max channel on the sun-facing limb (N·L > 0.25, rho > 0.86) stays under the lit-disc p99. No output clamp |
| Heading | the round-1 ±15° band, not moved. At 24 s the visible fraction is over 30%, so the angle stands |
