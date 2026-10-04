Built: Eclipse Gate is a measured loft, authored 28 m (mesh span 27.7 m), width 16.18 m, depth 6.82 m, opening 7.314 × 18.558 m, seated at (18.451, 25.657) on the heading-32 corridor. One atlas skin. Veins are pixels on that skin. The eclipse mark is painted above the lintel, not inside the opening.
Checked: `python3 tools/ruins/build.py --kit howling-eclipse` and `selftest.py` PASS (gate approach 48.932 m, wreck 11.201 m, 14 parts). `tools/hard-objects/rebuild.py` PASS. Root `npm test` exit 0. `tools/playcheck` 43 pass. `tools/sky/check.py` PASS (13 slices, 0 failures). `tools/rocks/selftest.py` PASS. Straight gallop blocked 0, crossed the opening (min distance to the opening centre 0.014 m, lateral 0, speed 4.4). Slide at 2.6 m lateral blocked 0. Slide at 3.2 m lateral blocked 7 frames, then continued at lateral 2.71 and speed 4.4. Wreck approaches min distance 1.20–3.13 m (old circle was 18 m). Max eye step 0.075 m. drawCalls 17→16, texMB 282.8→282.8, download 45,228,594 bytes (43.13 MiB; step 4 reported 44.7 MB), ruinLoadMs 821→449.5 after firstFrameMs 1355. Imagine 4/12, 0 video. Bolt sha matches the base file. Protected diffs empty.
Known issues: eclipse mark sits above the lintel (two cooks, not recooked). Worst close-up mag 14.99 on the elevation (36.64 texels/m at 3.265 m, along 59.25). Thickness faces are 182.99 texels/m; the vein eye measured that face at mag 3.19. Mag edges are binned at 0.32 m. Mesh span is 27.7 of 28. Wreck scorch and the basin edge were not done. Several headings reach about 1.2 m of the wreck centre because the loft is a shell. The QC clip holds sampled play frames; it is not a continuous capture.

Verdict: FAIL

| row | measured | PASS/FAIL |
|---|---|---|
| 1 Gate in play | height authored 28 m, mesh y 0..27.7; opening 7.314 × 18.558 m; one contact, sink 0.18 m; footprint badIn 0, badDome 0; veins on the skin; eclipse mark above the lintel, not in the opening | FAIL |
| 2 Gallop and walls | blocked 0 over 980 frames; crossed along 50; min anchor 0.014 m; max lateral in the gate band 0; speed 4.4; eye step 0.075 m; graze slide blocked 0; tight slide blocked 7 then speed 4.4; keep circle not used; wreck minD 1.20, 1.22, 1.22, 1.21, 1.21, 1.21, 3.13, 1.48 m | PASS |
| 3 Generator | `build.py --kit howling-eclipse` PASS; `selftest.py` PASS; `tools/hard-objects/rebuild.py` PASS | PASS |
| 4 Parts once | pier-l, pier-r, lintel measured on front.jpg with their own sections; opening is a hole; eclipse mark is paint on front.jpg, not a second solid, inpaint null; thickness faces use detail.jpg on the same loft | PASS |
| 5 Magnification | elevation 36.64 texels/m, nearest allowed 48.932 m; thickness 182.99 texels/m, nearest allowed 9.80 m; worst gallop close-up mag 14.99 (front, dist 3.265 m); vein eye mag 13.29 front / 3.19 near; ring eye mag 8.63 front / 1.73 near; bins 0.32 m | FAIL |
| 6 Gates | npm test 0; playcheck 43/43; sky check PASS; rocks selftest PASS; console logs 0; Bolt sha match; `git diff 274cab6 -- lock/` empty; protected sky/ground/rocks/hard-objects diff empty; Imagine 4/12 | PASS |
| 7 Perf | drawCalls 17→16; texMB 282.8→282.8; download 44.7 MB reported → 45,228,594 bytes (43.13 MiB); ruinLoadMs 821→449.5; gate loads after the first frame | PASS |
| 8 Proof | stills 01-spawn, 02-approach, 03-through, 04-farside, 05-ring, 06-veins, 07-slide; qc-gallop.mp4 720×1600, 14.4 s, 697 KB | PASS |

Part table:

| part | measure | spot | section | skin | erased from | inpaint |
|---|---|---|---|---|---|---|
| pier-l | front.jpg | 119,433,231,1114 | sec-pier-l.jpg | front.jpg | null | null |
| pier-r | front.jpg | 577,433,711,1114 | sec-pier-r.jpg | front.jpg | null | null |
| lintel | front.jpg | 119,89,711,433 | sec-lintel.jpg | front.jpg | null | null |
| opening | front.jpg | 231,433,577,1112 | none | none | hole | null |
| eclipse mark | front.jpg | 304,202,529,295 | none | front.jpg | null (not a second volume) | null |
| passage wall | detail.jpg | 0,0,832,1248 | none | detail.jpg | same loft, not a second solid | null |

Shots: `01-spawn.jpg` from spawn, `02-approach.jpg` on the way in, `03-through.jpg` in the opening, `04-farside.jpg` past the gate, `05-ring.jpg` crest, `06-veins.jpg` wall, `07-slide.jpg` off the centreline. Full clip: `/workspace/grokcli/out/zoneA-step4/gate-redo/qc-gallop.mp4`. Committed copy: `packs/zone-a/proof/step4b/qc-gallop.mp4`.

Run: `python3 tools/ruins/build.py --kit howling-eclipse && python3 tools/ruins/selftest.py`. Play proof: serve this worktree on 127.0.0.1 and run `node /workspace/grokcli/out/zoneA-step4/gate-redo/fastprove.mjs` (`tick(dt, {draw:false})` for the long counts, one painted frame per still).

Collider: `collide.js` was not in the tree. This step adds it. Edges come from the loft. `keepRadiusM` is stored and `keepUsed` is false. Play does not push a circle.
