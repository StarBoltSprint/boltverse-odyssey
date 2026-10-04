# Step 4c — wreck skins, ruin seating, camera pitch

Verdict: PASS

Date: 2026-10-04. Branch `zone-a-step4-gate-redo`. Imagine calls: 0.

## Done when

| Row | Result |
| --- | --- |
| Root `npm test` | PASS (exit 0) |
| `tools/playcheck` `npm test` (playcheck + ruinwalk) | PASS, 50 tests, 0 fail. Ruin walk shake 0, invisible walls 0, hangar min near 0.491 m |
| `python3 tools/ruins/selftest.py --kit howling-eclipse` | PASS. Opening, hangar, and arch piers walkable |
| Wreck outside, hangar inside, gate base, gate top | `01`–`04` below, 720×1600, walkable poses |
| No black wreck slab | Retile onto the existing plates. Largest dark blob in the hangar frame is a ground crack, not a face |
| Bases seated | Gate footGap 1.371 m, 106 skirts. Arch footGap 0.267 m, 118 skirts. Wreck footGap 0 |
| Pitch | Drag to 1.40 rad, shake 0, returns to 0, stick ignored, crown in frame |
| drawCalls / texMB | 11 / 256.76 |

## What changed

The flat seat is one height. The downhill monolith foot was 1.37 m above the relief. `appendSkirts` hangs only the lowest ring down to `heightAt` minus sink, in the same ruin draw. Those faces are not collider cells. The gate foot repeats the surface plate at its native density. The arch and any other skin shift into stone already in that island. The whole solid is not translated, so the opening stays on the crest.

Look pitch is an offset on the chase pitch. Vertical drag on `#view` outside the stick, and the same pointer path for a mouse. Critically damped while held and while returning. Clamped so the 28 m crown stays in frame (absolute pitch 1.40 rad) and the offset never flips the rig. Released, it eases back to the chase. The eye does not move, so the ruin clearance is unchanged. Idle look is the old chase, which is why ruinwalk's shake count stays 0.

Black wreck triangles were copied onto a mid-tone window of the same skin, at that skin's texel rate (`tools/ruins/wreck.py` `retile_black`). No new texture and no second part. Port 303 of 3232 dark, 1 left. Starboard 1255 of 2758, 7 left. Top, belly, and stern left 0. The eight leftovers sit on dark specks inside the chosen windows.

Bolt's gallop file was not opened for write.

## Shots

| Shot | Path | Pose |
| --- | --- | --- |
| Wreck outside | `packs/zone-a/proof/step4c/01-wreck-outside.jpg` | eye [−13.050, 1.819, 12.401], pitch −0.244, clear 8.36 m |
| Hangar inside | `packs/zone-a/proof/step4c/02-hangar-inside.jpg` | eye [−21.781, 0.430, 20.332], pitch −0.153, clear 0.99 m |
| Gate base | `packs/zone-a/proof/step4c/03-gate-base.jpg` | Bolt (28.54, 20.11), eye [34.790, 3.977, 16.671], pitch −0.032, clear 99 m |
| Gate top | `packs/zone-a/proof/step4c/04-gate-top.jpg` | eye [12.090, 5.143, 14.082], pitch 1.40, look offset 1.70, clear 13.0 m |

`05-arch-base.jpg` is the kept arch from the low side. The piers meet the relief.

The gate-base contact was checked against a one-off solid colour on the foot branch (not shipped). That colour filled the band under the slab, from the mesh bottom to the ground. The shipped pixels in that same band are the surface plate, not the sky. A full-frame glance can still read the dark stone as a gap; the mask does not.

## Pitch proof

Mouse and touch on the view, same numbers: pitch reached 1.40 and held, shake samples 0, min clearance about 13 m. After release, look offset returned to 0 (0.036 after 4 s on a full drag, 0 after 5 s on a smaller one). A pointer on the stick left look at 0. Crown test: pitch 1.40, offset 1.70, the top of the monolith is inside the frame.

## Budget

`__play.texReport` on the proof page: draws `{hulls:2, rocks:1, ruins:1, terrain:2, total:11}`, texMB 256.76. No new texture and no new draw. The step 4b line of 17 draws and 293.4 MB is the counter from before the one-draw pack.

## Known issues

- Eight retile centroids still land on dark specks (port 1, starboard 7). The hangar frame still has small jagged dark edges where the hull is already open. Stopped. No third cook.
- Close-up magnification still exceeds 1 when the camera stands against a 70 texels/m hull (about 43× at 0.85 m). The skirt uses the 183 texels/m plate, so it crosses 1 inside about 9.8 m. Pixels are not scaled up in code.
- The monolith crown stays stair-stepped (5 px loft grid).
- No playcheck row reads the foot gap in the framebuffer. `info().seats[].footGap` is the number. The picture is the proof.
- Debug HUD stays off unless `?debug=1`.

## Commit

`1772cd88a7af5231384dc29f612d82660ccc5fe2` (`1772cd8`) on `zone-a-step4-gate-redo`. Not pushed.
