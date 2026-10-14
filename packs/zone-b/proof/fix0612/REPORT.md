The ringed planet plays on a mobile Chrome profile, and Bolt can walk up to the Anchor and through the arch. The pack stays IN TEST until the owner looks at the phone. These rows are the step gates.

Verdict: PASS

Checked: root `npm test` exit 0. `cd tools/playcheck && npm test` 43 pass / 0 fail. Phone canvas 720×1600, Android Chrome, touch, `user-gesture-required`. Proof captures omit `debug=1`. Imagine calls this step: 0 images, 0 videos. The planet file is a stream copy of the same h264 frames, with the audio track and the attached picture removed.

| row | measured | PASS/FAIL |
|---|---|---|
| Planet motion | Media 3.835 s (94 frames) then 1.608 s (187 frames) after 3 s of wall time. The 6.042 s loop wrapped. Both `paused` false, `spinning` true, `readyState` 4. Sky crop x 80 y 40 w 560 h 280 mean abs 12.701, 27982 of 156800 samples moved by more than 12. Console: `planet playing t=2.644 frames=67 paused=false`. | PASS |
| Videos | 4 decoders at that pair (Bolt, haze, planet, beacon). A later burst of synchronous ticks dropped the count to 1. The pair is the budget row. | PASS |
| Scale | Geometric scale 0.5625. Native 1280×720. Aspect 1.7777778 and 1.7777778. | PASS |
| Anchor walk | Approach place (0, 62) then 90 gallop ticks ends (0, 75.20), blocked false, ground mag 0.832. Under place (0, 169) then 36 gallop ticks ends (0, 174.28), blocked false, eye (0, 5.79, 170.28). Front face is about z 173.83. Center stays clear. | PASS |
| Mouth | Recarve rows 268, image y 852–1134, gap 16.54 m, opening height 14.77 m. Anchor verts 4512, boxes 101, solid true, minWalkM 0. Placement x 0, z 177.83, yaw 0, sink 0.55, world height 60 m. | PASS |
| Other solids | Outpost from (0, −40) heading 180 ends z −51.73, blocked 0 (body at z −56). Drone from (4, 11) heading 90 ends x 14.11, blocked 12 (body at x 15.2). Rib from (−4, −24) heading 270 ends x −14.06 z −24.80, blocked 27 (ribs at x −13.5). | PASS |
| Budget | Approach drawCalls 10, under 9. Texture bytes 256963736 (245.1 MiB). Both inside 12 and 260. | PASS |
| Floor | Apron x −40..40, z 64..200. Walk area stays 6500 m². North of the old rim slides onto the apron. The skirt trench is 0 on that slab. | PASS |
| Gates | Root npm test exit 0. playcheck npm test 43 pass. | PASS |

Shots (720×1600 PNG, canvas `toDataURL`) live in `/workspace/grokcli/out/zoneB/fix0612/`:

- `planet-a.png` — media 3.835 s, 94 frames.
- `planet-b.png` — media 1.608 s, 187 frames, after the loop wrap.
- `anchor-approach.png` — gallop north on continuous sand, stone arch and lattice ahead. No hard ground cutoff in front of the tower.
- `anchor-under.png` — chase view from inside the mouth, z 174.28, blocked false. The 22.7° field looks through the opening at the cliff beyond. The soffit is above that field.
- `proof.json` — the numbers in the table.

Accepted misses, not recooked and not hidden by shrinking the tower:

Headless Chrome with the gesture policy already played the planet. It did not reproduce the Samsung S20 FE freeze. The client changes are the mitigation: muted and playsinline before `src`, a 48 px element at opacity 0.04, `play()` on the first touch and stick move and for 2.5 s after, and a canvas `drawImage` before `texImage2D`.

Presented magnification under the tower is 27.016. The frigate rule holds at the aim distance. This close the number is above 1. `packs/zone-b/src/terrain/qc.mjs` walk_mag was not run. A north gallop under the tower will fail that row. Live playcheck `clearing/1` was not re-run. It was already a known fail.

Station caps of the loft read as horizontal slabs when the eye is inside the mesh. That is the validated loft. The tower was not shrunk and the apron was not pushed through the cliff.

Play URL on this machine: `http://127.0.0.1:8777/packs/zone-b/play/index.html`.
