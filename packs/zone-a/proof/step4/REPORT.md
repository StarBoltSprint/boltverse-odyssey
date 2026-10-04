Built the Eclipse Gate (far ridge, 7.4 m) and a Howl-class wreck (side pocket, length 14 m) with the kit-driven RuinGenerator. Both are lofted meshes, seated on the relief, loaded after the first frame.

Checked: `tools/ruins/build.py` and `selftest.py` PASS (gate approach 11.508 m, wreck 11.201 m, 13 parts). `tools/hard-objects/rebuild.py` PASS. Root `npm test` 0, `tools/playcheck` 43 pass, `tools/sky/check.py` PASS (13 slices, 0 failures), `tools/rocks/selftest.py` PASS. Play: drawCalls 10→17, texMB 236→282.8, download 40.3→44.7 MB, ruinLoadMs 821 after first frame. Heading-32 gallop blocked 0. Frame mag 0.998 on the proof eyes. Imagine 6/30, 0 video.

Known issues: front plate has mild perspective; pier sections are silhouettes; ring is skin; wreck keeps the sealed Howl plating (no scorch recook); nacelles and bells are omitted, not duplicated; a rock intersects the hull; backing the camera into a keep can exceed magnification 1; corridor ground reaches 1.060 at (10.3, 12.1), which is the existing relief.

## Shots

| File | What |
|---|---|
| `spawn-toward-gate.jpg` | Spawn bearing toward the gate. Eye (−5.66, 4.03, −11.83), boom 6.2 m, mag 0.998. Gate ruin mag 0.251. |
| `gate-mid.jpg` | Mid ridge, 24 m from the gate. Eye (−1.71, 6.42, 13.39), mag 0.998. Gate ruin mag 0.566. |
| `wreck-angle-1.jpg` | Basin side. Eye (−3.74, 8.11, 20.57), pitch −23°. |
| `wreck-angle-2.jpg` | High bank. Eye (−33.16, 30.91, 32.00). |
| `wreck-angle-3.jpg` | Opposite bank. Eye (−44.60, 28.34, 4.28). |
| `wreck-angle-4.jpg` | Lower side. Eye (−15.68, 8.23, −8.37). |
| `wreck-seat.jpg` | Nose contact (−19.14, 8.20), seat y −1.853. Eye (−9.14, 9.33, 0.20). Wreck ruin mag 0.931. |
| `qc-ruins.mp4` | 6.5 s, 720×1600, 1.0 MB. Full file also at `/workspace/grokcli/out/zoneA-step4/qc-ruins.mp4`. |

Run: `python3 -m http.server 8940 --bind 127.0.0.1` in this worktree, then open `packs/zone-a/play/index.html`. Rebuild with `python3 tools/ruins/build.py --kit howling-eclipse`.

## Done when

| row | measured | PASS/FAIL |
|---|---|---|
| 1 Gate + wreck in play, walk-around, seated, inside the dome, corridor gallop blocked 0 | seats y 1.048 and −1.853; rim distances 85 m and 70 m; gallop 70 ticks blocked 0; shots above | PASS |
| 2 One command + selftest + both measure gates + Howl rebuild | build PASS; selftest parts 13, approaches 11.508 and 11.201; `rebuild.py` PASS (5376 verts) | PASS |
| 3 No duplicated parts | table below; no second volume; inpaint calls this step: none | PASS |
| 4 Magnification ≤ 1 per object | gate 155.81 texels/m, d_min 11.508, play mag 0.251 and 0.566; wreck 160.07 texels/m, d_min 11.201, play mag 0.744–0.931; frame mag on those eyes 0.998 | PASS |
| 5 npm test, playcheck, sky, rocks, no console / WebGL errors | root 0; playcheck 43 pass; sky failures 0; rocks PASS; console errors [] | PASS |
| 6 Bolt sha, protected diffs, no style words, Imagine ≤ 30 | bolt sha matches baseline; lock/ sky/ ground/ rocks/ tools/sky diffs empty; cooklog n=6, videos 0 | PASS |
| 7 Perf delta | download 40.3→44.7 MB; texMB 236→282.8; drawCalls 10→17; ruinLoadMs 821 after firstFrameMs 5494 | PASS |
| 8 Proof + this report | JPEGs, qc-ruins.mp4, this file | PASS |

## Parts

| part | measure | pixel spot | skin erased | inpaint |
|---|---|---|---|---|
| pier-l | front.jpg | 66,394–216,1202 | none (the loft is the jamb) | none |
| pier-r | front.jpg | 594,394–772,1202 | none | none |
| lintel | front.jpg | 66,50–772,394 | none | none |
| opening | front.jpg | 216,394–594,1202 | no faces | none |
| ring-motif | front.jpg | same arch band | skin only, not a volume | none |
| hull | Howl measure/port.jpg | 75,75–2344,361 | port.jpg already plain in the sealed cook | not this step |
| hull-stbd | Howl measure/stbd.jpg | 103,75–2344,361 | not rebuilt as a second skin | not this step |
| deck | Howl measure/top.jpg | 140,119–2337,401 | nacelle pixels already absent | not this step |
| belly | Howl measure/belly.jpg | 75,119–2337,401 | sealed plate | not this step |
| stern-cap | Howl measure/stern.jpg | stern faces | bells stay off | not this step |
| nacelle-port | Howl top | u 0.0255, x −106.3, z −17.5 | top.jpg | not rebuilt (skinNacelles 0) |
| nacelle-stbd | Howl top | u 0.0255, x −106.3, z +17.5 | top.jpg | not rebuilt |
| hangar | Howl port | u 0.289–0.482 | hole kept, no faces | not this step |

## 2026-10-04 — collisions follow the real geometry (owner decision: no invisible walls)

Keep-out circles removed. Colliders are rebuilt in play from the `.ruin` faces (`packs/zone-a/play/collide.js`; recipe `docs/METHOD/ruins.md` §7). Bolt gallops through the arch (4.4 m/s held, 0 blocked, 0 sideways push) and into the wreck's hangar (3.25 m deep, under the deck), turns round and runs out. Wreck re-seated on its hangar sill at 32 m (yaw 205°, pitch −2°, sink 0.05 m) so the 1.81 m bay fits Bolt.

| Check (`tools/playcheck/src/ruinwalk.test.mjs`) | measured |
|---|---|
| Arch run | top 4.4 m/s, slowest after top 4.4; camera step ≤ 0.282 m, jerk 0.026 m, shake 0, near plane clear |
| Hangar in / turn / out | depth 3.25 m; camera step ≤ 0.459 m, jerk ≤ 0.270 m; shake 0 on the runs, 2 in the on-the-spot turn; eye ≥ 0.53 m from the hull, near plane ≥ 0.56 m |
| Walls (both piers, closed hull) | stopped 0.010 / 0.011 / 0.081 m from the drawn face; body never inside a face |
| Slides (gate pier, hull side, 30°) | 3.87 / 3.57 m/s along the face (tangential gallop 3.81), 0 blocked, shake 0 |
| Sweeps (36 lines across and around) | 0 contacts without a drawn face within r + 0.2 m; 4 near-miss lines 0.2 m off the bounds: 0 contacts |
| Perf | drawCalls 17, texMB 282.8 (unchanged; colliders are CPU only) |

Worst close-up magnification (known issue, pixels never stretched by code): wreck hull inside the bay 43× (0.85 m, 49 texels/m), hull outside 10.8×, gate pier under the arch 3.3×, lintel 1.2×; Bolt's sprite 6.2× with the short boom in the bay. The hangar interior has no Imagine skin and reads black. Clips: `/workspace/grokcli/out/zoneA-step4/collision/`.
