# Run 33 round 7

Not a KEEP. Not live. Not merged. Draft stays draft.

The tooth mesh is the round-5 mesh. Dark-row, corridor, horizon, draws, and the texel floor are unchanged. Snow p50 was not tuned. Exposure and the grade were not changed.

## 1. Repeat

Round 5 added a second copy of the hex lattice and mixed the two at 0.5. Both copies share the cell period, so the sum is a lattice (the round-5 crops sit about +0.18 over the still, with a second harmonic). Rotating world xz does not turn the rows on a vertical face, so the bands stayed horizontal.

The tooth path is now one hex sample. The rows are rotated on the face by the per-tooth angle. The cell interior is one of glacier-ice v1, v3, or v4. v2 is the dark still. A two-pixel sliver of it between a fall and an arch cleared the dark-row bar, so v2 stays in the blend at 0.05 and is not the interior. The cell edge is the blend. The cell is smaller (cells 5) so a face 25 m away is not one smooth tile.

| Crop | 12 px | 19 px | 32 px |
| --- | --- | --- | --- |
| t=24 tooth, 290,80 | −0.255 | −0.324 | −0.305 |
| t=30 tooth, 300,40 | +0.093 | +0.011 | −0.065 |

Both pass at 12, 15, 19, 24, and 32. The plain-tile fixture still fails. The glacier-ice still still passes. A grazing near flank at t=30 (the lower spire) still correlates with itself: the footprint is a streak, and that crop is not the one shipped. Stretch stays 1.30. 2048 px/m. Magnification stays inside the texel gate.

## 2. Ice lightness

The sun term is on. Wall ice uses `litIce`, the same sun as the other ice. The shade normal matches the geometric normal (tooth mean sun-dot 0.400 geometric, 0.407 shade). `keepWallsOut` is gone. Nothing multiplies the sun by zero.

Linear luma before the grade, albedo held at 1:

| Face | Sun | Ambient | Fill | Sum |
| --- | --- | --- | --- | --- |
| ndl 0, vertical | 0.000 | 0.160 | 0.256 | 0.416 |
| ndl 0.32, vertical | 0.250 | 0.160 | 0.000 | 0.410 |
| round-3 top wall (mean ndl 0.31) | 0.244 | 0.160 | 0.141 | 0.546 |
| round-5 tooth (mean ndl 0.11) | 0.084 | 0.160 | 0.212 | 0.457 |
| side wall, both rounds (ndl 0.67) | 0.631 | 0.160 | 0.000 | 0.791 |

The fill is off at ndl 0.32 and fully on at ndl 0, and those two sums match (0.410 and 0.416). A slope at either end displays the same lightness. The round-3 top is brighter because its pixels are split: lit pixels take the sun, shaded pixels take the fill, and the average keeps both. That is the shade curve. It was not changed. The remaining gap stays with the grade.

After the tooth blend, ice dE76 is 10.81–12.05. dL is −10.2 to −11.5, da about +2.5, db about −2.3 to −3.2. Snow p50 at 11.70 s is 0.657 against the key 0.708.

## Other gates

| Check | Round 7 | Bar |
| --- | --- | --- |
| corridor hits | 0 | 0 |
| horizon_closed 0 / 0.9 / 1.57 | 1 / 1 / 1 | ≥ 0.98 |
| follow sky-window, six stills | 0.023–0.092 | ≤ 0.12 |
| dark-row, six stills | pass | X=32 |
| dark-row, chase t=20..32 | 61/61 pass | X=32 |
| round-2 t=30 dark-row | fail | must fail |
| round-3 t=24 / t=30 sky-window | 0.757 / 0.860 | must fail |
| CPU / page triangles | 196234 / 196866 | ≤ 197000 CPU |
| draws | 9 | ≤ 12 |
| texel | PASS, glacier-ice stretch 1.30 | ≤ 1.3, 2048 px/m |
| keyscore | 91.98 | ≥ 85.84 |
| Bolt x | 360.00 | 360 |

Chase t=20..32 is recaptured on this shader. Numbers for the light split: `ice-light.json`.

No KEEP.
