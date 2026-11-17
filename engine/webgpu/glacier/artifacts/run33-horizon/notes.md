# Run 33 round 6

Not a KEEP. Not live. Not merged. Draft stays draft.

Round 5 stays: the dark row is fixed (61/61 from t=20 s to t=32 s, the round-2 fixture still fails), the follow sky-window and crest-stair gates stay, the canyon mesh stays, the teeth stay wall-tagged, corridor hits stay 0, horizon_closed stays 1/1/1, 9 draws, Bolt x=360.00, card 1.15 m. Snow p50 was not tuned.

The mesh and the ice shader are the round-5 ones. The stills, the 3× crops, and `chase.mp4` are those captures. A sunward rebuild and a serac swap were rendered, measured, and put back.

## 1. Repeat gate

The old bar took the strongest autocorrelation peak outside a 20 px disc and failed above 0.31. One glacier-ice still scores 0.44 on that test, so the bar was the photograph.

`repeat-gate.mjs` now scores only the on-screen tile period and its second harmonic, and compares each to the same lag on `tex/glacier-ice/v1.jpg`. The period is `focal * 0.5 m / distance * crop scale`, with focal `(1280/2) / tan(31°)`. At the t=24 teeth the camera is near z=-164 and the row is near z=-250, so the distance is 86 m and a 3× crop has a period of 18.6 px. Fail if the crop exceeds the still at that lag by more than 0.10, or if both harmonics do (a lattice).

| Image | Period | Crop | Still | Over | Verdict |
| --- | --- | --- | --- | --- | --- |
| plain tile, one still, no rotation | 64 | 1.00 | 0.26 | +0.74 | fail, lattice |
| glacier-ice v1, same lag | 64 | 0.26 | 0.26 | 0 | pass |
| round-4 t=24 | 18.6 | 0.457 | 0.460 | −0.003 | pass |
| round-4 t=30 | 18.6 | 0.403 | 0.460 | −0.057 | pass |
| round-5 t=24 | 18.6 | 0.637 | 0.460 | +0.178 | fail, lattice |
| round-5 t=30 | 18.6 | 0.639 | 0.460 | +0.179 | fail, lattice |

The same split holds at periods 12, 15, 19, 24, and 32: the round-4 crops stay within 0.10 of the still, and both round-5 crops stay above it with a second harmonic. The plain-tile fixture fails first. The still itself does not.

## 2. Ice CIE76

Key glacier-ice Lab is [69.71, −4.41, −10.33]. The error is lightness. Colour is a few units.

| Still | Ice dL | da | db | dE | Wall dL | da | db | dE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5.10 s | −12.39 | +2.04 | −3.57 | 13.06 | −12.59 | +1.91 | −4.34 | 13.45 |
| 5.567 s | −12.40 | +2.05 | −3.60 | 13.07 | −12.61 | +1.90 | −4.37 | 13.48 |
| 7.9 s | −12.75 | +2.03 | −4.30 | 13.60 | −12.98 | +1.85 | −4.54 | 13.88 |
| 11.70 s | −12.61 | +2.01 | −4.37 | 13.49 | −12.92 | +1.83 | −4.64 | 13.85 |
| 24 s | −11.76 | +2.24 | −3.39 | 12.45 | −12.59 | +1.86 | −4.32 | 13.44 |
| 30 s | −12.39 | +2.00 | −4.49 | 13.33 | −13.13 | +1.69 | −4.89 | 14.11 |

Round-3 top walls were L* 66.8 at ndl p50 0.03 (mean 0.31). Round-5 top walls are L* 57.1 at ndl p50 0.00 (mean 0.11). The side walls are unchanged (L* 86.9, ndl 0.67).

A continuous slope aimed between the sun and the chase, ndl mean 0.32, stretch 1.28, follow window 0.048, dark-row pass: the top wall was still L* 57.0. Its unlit albedo graded to L* 68, about dE 2 from the key. A camera-facing slope at ndl 0.007 graded to L* 56.3, dE 14.5. Raising the lit share does not lift the displayed lightness. Both ends of the range land near L* 57 after the grade.

The shade fill on ice is the constant (0.20, 0.26, 0.38), and the ambient is the constant (0.14, 0.16, 0.22). Neither samples the sky. Sky zenith (0.16, 0.22, 0.46) has lower luma than the fill, and the horizon sky is peach. Pointing the fill at the sky would not lift L*, and it would warm the ice. It was not changed. Exposure was not changed.

The four serac stills sit at dE 5.17 from the glacier-ice key (dL −3.54, da +2.68, db −2.64). Sampling them on the teeth only, one t=24 frame: ice dE 14.14 (dL −12.80, da +3.22, db −5.07), worse than glacier-ice. Put back.

## Other gates

Unchanged from round 5, because the mesh is unchanged.

| Check | Round 6 | Bar |
| --- | --- | --- |
| corridor hits | 0 | 0 |
| horizon_closed 0 / 0.9 / 1.57 | 1 / 1 / 1 | ≥ 0.98 |
| follow sky-window, six stills | 0.023–0.092 | ≤ 0.12 |
| dark-row, chase t=20..32 | 61/61 pass | X=32 |
| round-2 t=30 dark-row | fail | must fail |
| CPU / page triangles | 196234 / 196866 | ≤ 197000 CPU |
| draws | 9 | ≤ 12 |
| texel | PASS, glacier-ice stretch 1.30 | ≤ 1.3, 2048 px/m |
| 11.70 s snow p50 delta | 0.0508 | 0.05, not tuned |
| keyscore | 91.22 | ≥ 85.84 |

`chase.mp4` is 720×1280, 61 frames, 12.2 s, 5 fps, t=20 s through t=32 s. Bolt mean x is 360.00.

Before: `artifacts/run32-hdr/before/` and `fixture-r3/`. Round-4 crops: `fixture-r4/`. Plain-tile fixture: `fixture-repeat/plain-tile.jpg`. 3× crops: `crops/t24-ice-3x.jpg`, `crops/t30-ice-3x.jpg`.

No KEEP.
