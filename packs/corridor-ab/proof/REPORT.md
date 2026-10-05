# Corridor hang

Verdict: PASS

Bolt can walk the hung corridor. The floor is zone A ground stills that were already cooked. No new Imagine file.

| # | Done when | Result |
| --- | --- | --- |
| 1 | `world.json` corridors equal `path-layout.json` `world_corridors` | PASS. One record, `path-ab`, length 15.95 m. |
| 2 | Waypoints stay in `path-layout.json`. `draws_pixels` false. `when` is `load`. | PASS. 12 waypoints. Both files say `when` `load` and `draws_pixels` false. |
| 3 | Zone A gate `leads_to` is `path-ab` | PASS. |
| 4 | Ground and tile assets are existing zone A files | PASS. Ground `packs/zone-a/src/ground/m1.png`. Cells use `m0`–`m5`. |
| 5 | `layout.py check --world` transition row | PASS `transition` corridors=1 speed_bad=0 ground_bad=0 gate_bad=0. Other zone rows fail. The stubs are not an organic clearing. |
| 6 | Play page places the files and walks Bolt | PASS. `?shot=mid` is corridor mode, along 7.2 m, heading 90, drawCalls 9, glError 0, Bolt idle ready. Proof `proof/walk-mid.png`. |
| 7 | No new Imagine file. No mid-run solve | PASS. Hang writes json, txt, and svg only. |
| 8 | Tests exit 0 | PASS `python3 tools/wfc-path/hang_selftest.py` and `node --test packs/corridor-ab/play/place.test.mjs`. |

## Still waiting

A scrolling corridor video, a zone B pack, and the Eclipse Gate loft on this mouth. The arrival plate is `m6.png` from zone A. `bakedGroundSpeed` 4 is stored and is not applied to a still. Stopped Bolt reports rate 0.
