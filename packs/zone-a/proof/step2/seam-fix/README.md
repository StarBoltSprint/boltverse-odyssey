Sky seam fix (2026-10-03). Before = zone A step 2d. After = neighbour-slice crossfade in the shader. Slice files are unchanged.
- `*-chase.jpg`: chase view at headings 0 / 90 / 285 / 330.
- `*-seam.jpg`: eye level aimed at the joints at azimuth 0 / 83 / 277 / 332, each at 12° and 45° up.
Play snapshot before and after: mag 0.998 (sky upper), no console errors. Gates: `tools/sky/check.py --manifest` PASS, root `npm test` PASS, playcheck 43/43.
The before shots were taken on the step 3 preview, which has the same sky as 2d plus the rocks, so their HUD shows drawCalls 10.
