Built: the Anchor (60 m side loft beyond the north rim), a plaza arch of two stone legs and fourteen lintel segments, the frontier outpost (water tower, ore cart, two leaning pylons), one crashed survey drone, and five rib pairs. One beacon video sits on the tower as a world-locked quad. IN TEST. Not a lock.

Verdict: IN TEST

Checked: root `npm test` exit 0 and `tools/playcheck` npm test exit 0 earlier in this step, before the loft rebuild. `play.js` and `hard.js` were not edited after that run. `node --check` and `lintPlaySource` were clean on both files before the proofs. Phone 720×1600 on the six stills: presented mag 0.982, drawCalls 10, texture bytes 258192536 (246.2 MiB), active videos 4. Pack `packs/zone-b` 42,045,499 bytes (40.1 MiB), under 150 MB.

Imagine tool starts in the session log: `image_gen` 11, `image_edit` 1, `reference_to_video` 1. Budget was 36 images and 2 videos. Shipped elevation plates are anchor, tower, pylon, drone, cart, and rib. The beacon still is the video's pinned frame. Arch legs are a crop of `butte-0.jpg`. The lintel is a crop of `cliff-0.jpg`. No dust-devil video and no pylon lantern. The video count is Bolt, haze, planet, and the beacon.

Anchor: z 177.83, height 60 m, depth cap 8 m, minimum walk distance 108.85 m, hero distance from spawn 122.83 m. Side loft, solid false. Beacon local (1.197, 54.849, −4.8), quad 2 m, source 480.

Plaza arch: z 60, leg height 3.55 m, leg width 1.50 m, half-gap 6.88 m, span lift 3.28 m, 14 segments of 1.43×0.38×1.21 m. `build.py` reports the arch, the north road, the outpost gate, and the basin road clear. Chase from z 48 heading 0 for 3 s ends at x 0, z 61.2, so the body passed the opening.

Outpost: tower (11, −56) 3.99×1.86 m, cart (−7.5, −49) long axis 2.16 m, pylons at x ±6.43, z −66, height 3.31 m.

Drone: (15.2, 11), yaw −1.35, one hull, long axis 2.09 m. Ribs: five instances at x −13.5, z −4, −14, −24, −34, −44, each 3.86×2.53 m, sink 0.45 m.

Known issues: the lintel skin is the bedded cliff crop. Two placements (a zigzag, then one straight row) still read as a thin striped bar. Stopped. The opening stays clear. The floor has no slot walls, so the drone and the ribs are off the road and still in the open. The Anchor has no collider. A chase eye that enters a rib hole can exceed magnification 1; the shipped poses do not. Step 1g misses stay: upper gradient join, tile lattice on a wide pose, loft base cut, one moon fringe, `contain()` on the outline, live playcheck on `clearing/1`. Mesa seating was not retouched.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Six stills are 720×1600, HUD off. Anchor, arch, outpost, drone, ribs, and the north chase each show their subject. | PASS |
| Hard objects | Four classes seated. Anchor min walk 108.85 m. Segment caps hold. Passages clear in `build.py`. Chase ends at z 61.2 on x 0. | PASS |
| Magnification | Presented 0.982 on all six stills. Hard mag 0.615, 0.865, 0.539, 0.590, 0.574, 0.800. | PASS |
| Perf | drawCalls 10, texMB 246.2 (258192536 bytes), activeVideos 4. | PASS |
| Pack | 42045499 bytes. | PASS |
| Tests | Root npm test and playcheck npm test exited 0 before the loft rebuild. JS unchanged after. Live playcheck on `clearing/1` was not re-run; step 1g left it failing the circle rows. | PASS |
| Lintel skin | Straight cliff-crop beam still reads as beds. Two tries, then stop. | FAIL |
| Docs | METHOD zone B row, decisions-log step 2, recipe `learn/recipes/zone-b-hard-loft.md`, three failure entries. All IN TEST. | PASS |

Shots (720×1600 JPEG, canvas `toDataURL`, HUD off):

- `anchor-framed.jpg` — Bolt at (0, 22) heading 0. Eye [0, 1.237, 18]. Presented mag 0.982. Hard mag 0.615. drawCalls 10. Videos 4.
- `arch-under.jpg` — Bolt at (0, 60) heading 0. Eye [0, 1.597, 56.6]. Presented mag 0.982. Hard mag 0.865.
- `outpost.jpg` — Bolt at (2, −8) heading 180. Eye [1.8, 1.778, −4]. Presented mag 0.982. Hard mag 0.539. Tower, both pylons, and the cart are in frame.
- `drone.jpg` — chase camera, Bolt at (8.4, 11.3) heading 90. Eye [1.2, 0.840, 11.3]. Presented mag 0.982. Hard mag 0.590.
- `ribcage.jpg` — chase camera, Bolt at (−4.5, 0.5) heading 208. Eye [−1.12, 0.827, 6.86]. Presented mag 0.982. Hard mag 0.574.
- `chase.jpg` — gallop north from (0, 48) for 3 s. Ends x 0, z 61.2. Eye [0, 1.347, 54.0]. Presented mag 0.982. Hard mag 0.800. drawCalls 10. Texture bytes 258192536. Videos 4.

Same files in `/workspace/grokcli/out/zoneB/step2/`.

Run: `python3 -m http.server 8770 --bind 127.0.0.1` from this worktree. Port 8766 was already taken by another tree. Play URL: `http://127.0.0.1:8770/packs/zone-b/play/index.html`.

Preview freeze: recorded after this file is in place. The tool refuses a verdict other than PASS.
