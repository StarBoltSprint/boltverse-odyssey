# Take note — glacier horizon — 2026-11-17

Engine gate, not a cook. `tools/quota/quota.py` was not run. No KEEP.

## This step

- Step: close the glacier horizon line, the right-shoulder ditch, and the near flat snow sheets.
- Accepted because: `node engine/webgpu/glacier/horizon-gate.mjs` PASS. horizon_closed 0.9986 / 1 / 1. Shoulder drop 0.104 m. Sheets 0. Caps 0. CPU tris 199266. Page tris 199898. Texel PASS.
- Recipe appended: none. The gate is `engine/webgpu/glacier/horizon-gate.mjs`.
- Failure appended: `learn/failures.md` heading `2026-11-17 — Glacier horizon line is a dithered far face plus a vertical snow crest`.

## Biggest waste

The first berm was tall enough to hide the one-pixel crest and then failed grey_bright at 0.161. Shortening it brought the crest back as the top edge. The kept height is 34 m at z=-340. The tonemap gate still misses three checks by a few thousandths. Limits were not moved.

## Reuse next time

- Do not bury a vertical sheet's foot and expect the crest to move.
- A material inside the LOD dither cannot close the eye-level row past 180 m.
- Page tris can sit ~600 above the Node count because `Math.sin` changes the ground step loop. Budget against the page number.

## Added this take

- New recipes: none.
- New failure entries: the horizon crest entry above.

## This step

- Step: round 3. Dark-row gate first, then close mcam 0 without entering the lat.
- Accepted because: `node engine/webgpu/glacier/horizon-gate.mjs` PASS. horizon_closed 0.9848 / 1 / 1. Corridor hits 0. Sheets 0. Caps 0. CPU tris 196051. Page tris 196682. Texel PASS. Card 1.15 m. Bolt x 360.00. Dark-row X=32 fails `fixture-r2-t30.jpg` and passes the six stills and 41 chase frames. Tonemap still FAIL: 11.70 s snow p50 delta 0.0508, 24 s p99 delta 0.0671. Limits not moved.
- Recipe appended: none.
- Failure appended: `learn/failures.md` heading `2026-11-17 — A camera-facing cliff is a black seam when the sun is down-canyon`.

## Biggest waste

Pushing wall vertices one at a time sheared them into a grazing edge and the forward row scored them as 0. Deleting those triangles opened a 75 m wall gap and the side camera. The fins that covered the row were the dark pixel. The replacement is a cliff outside the lat, with the shade normal taking part of the sun so the rim is not black.

## Reuse next time

- A constant-z face aimed at this chase is unlit, because the sun points down the canyon.
- The dark-row bar has to sit on the t=30 crease (dip about 40). A lower bar flags arch grain and drifts.
- Page tris sit about 630 above the Node count. Budget both. This step's page count is 196682.

## This step

- Step: round 4. Follow-camera horizon gate and crest-staircase gate first, then close that picture without bulldozing the canyon.
- Accepted because: `horizon-gate.mjs` PASS, closed 1 / 1 / 1, corridor hits 0, sheets 0, caps 0, CPU tris 196234, page tris 196866, draws 9, texel PASS, card 1.15 m, Bolt x 360.00. `follow-horizon-gate.mjs` fails `fixture-r3/t24.jpg` (window 0.757, stairs 2) and `t30.jpg` (window 0.860, stairs 6). The six new stills pass (window ≤ 0.024, stairs ≤ 1). Dark-row fails `fixture-r2-t30.jpg` and passes the six stills. Chase dark-row fails one frame, t=24.6. Tonemap FAIL: ice dE76 12.86–13.42, 11.70 s snow p50 delta 0.0508. Limits not moved.
- Recipe appended: none.
- Failure appended: `learn/failures.md` heading `2026-11-17 — The level horizon row is snow in the follow frame`.

## This step

- Step: round 6. Redefine the repeat gate, and split the ice error before moving a tooth.
- Accepted because: the plain-tile fixture fails the new gate (over +0.74, lattice) and `tex/glacier-ice/v1.jpg` passes the same lag. Round-4 crops pass (over −0.003 and −0.057). Round-5 crops fail (over +0.178 and +0.179, lattice). The split holds from period 12 px through 32 px. Tonemap still FAIL. Ice channels are dL −11.8 to −13.1, da about +2, db about −4. A slope at ndl 0.32 and a slope at ndl 0.00 both displayed near L* 57. Serac on the teeth made one frame dE 14.14. Those trials were reverted. The tooth mesh is the round-5 mesh. Dark-row, follow, corridor, and texel floors were not moved. Snow p50 was not tuned.
- Recipe appended: none. The gate is `engine/webgpu/glacier/repeat-gate.mjs`.
- Failure appended: `learn/failures.md` headings `2026-11-17 — A peak anywhere in the autocorrelation is the photograph` and `2026-11-17 — Matching the wall sun-dot does not lift ice L*`.

## Biggest waste

Two full-frame slopes and one serac swap, each a render, none of which moved L*. The albedo was already near the key. The displayed lightness is the grade on the irradiance, and it lands near L* 57 whether the face is shaded or lit.

## Reuse next time

- Do not set an autocorrelation bar the source still fails. Compare the tile-period lag to that lag on the still.
- ndl mean is not the ice median. These teeth grade to the same L* at ndl 0 and at ndl 0.32.
- Serac stills are further from the glacier-ice key than the glacier-ice albedo is. They do not close this dE.

## This step

- Step: round 7. Remove the two-copy tooth lattice, and measure sun against fill before touching the grade.
- Accepted because: both 3× crops pass `repeat-gate.mjs` at periods 12, 15, 19, 24, and 32. The plain tile still fails. The glacier-ice still still passes. Follow sky-window on the six stills is 0.023–0.092. Dark-row passes the six stills. Round-3 fixtures still fail the follow gate. Round-2 t=30 still fails dark-row. Texel PASS, glacier-ice stretch 1.30. Draws 9. Page tris 196866. Sun at ndl 0.32 is luma 0.250 and the fill is 0. At ndl 0 the fill is 0.256 and the sun is 0. The sums match. The grade was not changed. Ice dE76 is 11.53–13.05, still over 10, and the split is still dL.
- Recipe appended: none. The tooth sample is `albedo.js`.
- Failure appended: `learn/failures.md` headings `2026-11-17 — Two copies of one hex lattice are a lattice` and `2026-11-17 — The ice shade fill replaces the sun's luma`.

## Biggest waste

A flat mix of the four stills made every cell the same average, so the autocorrelation did not move. The cell interior has to stay one still. A grazing flank is a streak either way, because the footprint is one long derivative.

## Reuse next time

- Do not mix two copies of a lattice at a constant weight. The sum keeps the period.
- Rotating world xz does not turn the rows on a vertical face. Rotate the face coordinates.
- The shade fill is sized to the sun it replaces. ndl 0 and ndl 0.32 land on the same luma. That gap is the grade's.
