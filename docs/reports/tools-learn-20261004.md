# Tools learn 2026-10-04

Date: 2026-10-04

Branch `tools-learn-20261004`. No Imagine calls. The committed rocks manifest was not rewritten. Nothing was pushed or merged.

The eight lessons are now a check, a placement rule, or a METHOD line dated 2026-10-04. The new lines are IN TEST. The sky recipe stays VALIDATED. `tools/sky/check.py` stays.

## Tests

| Command | Result |
|---|---|
| root `npm test` | exit 0 |
| `cd tools/playcheck && npm test` | 55 pass, 0 fail, exit 0. Ruin walk included (gate, arch, hangar, walls, slides, sweeps, shake 0). |
| `python3 tools/frames/selftest.py` | PASS |
| `node tools/rocks/place.mjs --selftest` | PASS. Counts crest 6, boulder 16, stone 28, pebble 40. A passage that covers the disk places 0. |
| `python3 tools/layout/passages.py` | PASS |
| `node tools/playcheck/src/premerge.mjs --selftest` | PASS |

## Zone A scan

Play frames from step 1, step 2 (seam-fix/before marked historical), step 3, and step 4c. Step 4 and step 4b are historical. Kitchen sheets (join, lookup, motion, normal, rim, ring-contact) were not scanned. The brief was `packs/zone-a/proof/step4c/decree-brief.md`, which has no `## Must show` heading. Full table: [zone-a-frames.md](tools-learn-20261004/zone-a-frames.md).

Current fails: 20. They do not close this tool step. They are the picture the new rows draw.

| Check | What the scan found |
|---|---|
| `foot_contact` | No current fail. `03-gate-base.jpg` passes. The visible hole the skirts closed is not re-opened by the pixel row. |
| `seat_foot_gap` | INFO. Gate footGap 1.371 m, 106 skirts. Wreck 0 m. Arch 0.267 m, 118 skirts. That number is the skirt drop. |
| `ground_frame` | No current fail on the step 1 plates or the step 4c scenes. |
| `sky_frame` | No current fail, including `zenith.jpg` and `seam-fix/after-seam.jpg`. `seam-fix/before-seam.jpg` also passes. The luma gate did not see that crop. Left as a known miss. |
| `heroes` | n/a. The zone A brief names no hero list. The ringed-planet miss is the selftest, where a brief that asks for the planet and a flat crop fails. |
| `untextured` | 12 current fails. `04-gate-top.jpg` is a flat at x 424, y 752, 296×632, area 0.073. Sky and chase frames also trip a flat or a black blob (heading 285, corona, loop, crest, eye-sky, chase-0, both seat shots). `02-hangar-inside.jpg` and `01-wreck-outside.jpg` pass this row. |
| `stair_crown` | 7 current fails. Gate base 7 runs, jump 8. Wreck outside 5 runs, jump 5. Gate top 4 runs, jump 5. Arch base 4 runs, jump 4. Chase 0 / 285 / 90 also fail. Hangar inside, gallop, and step 3 wide pass. |
| `mag_hotspots` | FAIL on the wreck skin (70.03 texels/m). Hangar clear 0.987 m is mag 25.954. Fixes: move the camera out to 25.61 m, set scale to 0.039, or recook at 1817.6 texels/m and do not enlarge the current texture. Wreck outside 12.959 m is mag 1.976 (camera 25.61 m, scale 0.506, recook 138.4 texels/m). Gate base, gate top, and crown use the near plate at 182.99 texels/m and stay at mag 0.75. Those three are notes, not fails. |

Passage audit, not a pixel row: `node tools/playcheck/src/premerge.mjs --audit` fails. `stone-23` (radius 0.311 m, x -14.395, z 15.459) sits in the wreck hangar passage. One hit of three passages (gate, wreck-hangar, arch). The manifest stays as committed. A later `place.mjs` run would skip that quad. This audit is not part of `npm test`.

Zone B stills were read in place and not copied here. `02-sky-000.jpg` fails `sky_frame` zenith_band at row 155, jump 45.5, agree 1.0. `04-wide.jpg` fails `ground_frame` hard_line at row 349 (jump 34.9, agree 0.997, flatStd 0.63) and void_band.

## Done and left

Done: decree brief, frame package, live playcheck rows, passage skip, pre-merge command, METHOD and decisions-log lines, this scan, both test commands.

Left: none in this step. SmiR phone-validates the IN TEST lines. The rocks manifest still contains `stone-23` in the hangar passage until a placement rewrite is asked for. `before-seam.jpg` is still invisible to `sky_frame`.

Verdict: PASS
