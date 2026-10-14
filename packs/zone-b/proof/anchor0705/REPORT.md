The Anchor is a solid at z 177.83, 60 m tall, and the sand continues under it. Magnification on the walk stays at most 1. The pack stays IN TEST until the owner looks at the phone. These rows are the step gates.

Verdict: PASS

Checked: root `npm test` exit 0. `cd tools/playcheck && npm test` 43 pass / 0 fail. `node packs/zone-b/src/terrain/qc.mjs` exit 0. Phone canvas 720×1600. Proof captures omit `debug=1`. Imagine calls this step: 0 images, 0 videos. The planet path from `5238234` is unchanged.

| row | measured | PASS/FAIL |
|---|---|---|
| Approach | place (0, 92) eye z 84.8, mag 0.982. place (0, 148) eye z 140.8, mag 0.982. The near frame is inside the mouth; the far frame holds the whole tower. | PASS |
| Under | place (0, 175.2) eye (0, 1.368, 168), pitch −3.07, blocked false. South face is z 166.83. Both piers are in frame. Sand continues through the north exit. | PASS |
| Tilt | Same eye, look-at (0, 42, 177.83), pitch 76.40. Lattice shaft overhead, piers on both sides. | PASS |
| Walk mag | Gallop from z 60 to z 244.95, 0 blocked ticks, magMax 0.9817991443596215. qc `walk_mag_max` 0.9979774516766561, `walk_mag_le_1` PASS. Tower height stays 60 m. Opening 5.90 m, depth 22 m, shaft from y 15.20. | PASS |
| Floor | Apron x −56..56, z 48..262. Walk area 6500 m². Ground verts 205607. Fade starts at rho 300, behind the tower. North cards sit at z 392..408, off the tunnel axis. | PASS |
| Relief | `relief_span_20m_m` 1.9479100797582198 PASS. `slope_max_deg` 11.954694099254759 PASS. `boot_clean` PASS. `console_errors` 0. | PASS |
| Drone | From (8, 11) heading 90 ends x 14.11, blocked 159. Hull west face is 14.43; pad is 0.32. The stop is that face. Boxes unchanged. | PASS |
| Rib | From (−13.5, −18) heading 180 ends z −23.19, blocked 125. Rib-2 north face is −23.51; pad is 0.32. Stand on the bone (−13.5, −24) stays blocked. Boxes unchanged. | PASS |
| Budget | drawCalls 10. Texture bytes 256963736 (245.06 MiB). Videos 4 (Bolt, haze, planet, beacon). Beacon world y 57.86, z 175.23. | PASS |
| Gates | Root npm test exit 0. playcheck 43 pass / 0 fail. qc four numeric rows PASS. | PASS |

Shots (720×1600 PNG, canvas `toDataURL`) live in `/workspace/grokcli/out/zoneB/anchor0705/`:

- `approach-far.png` — place (0, 92). Whole tower, both piers, sand to the feet.
- `approach-near.png` — place (0, 148). Mouth fills the frame. Lattice across the top of the opening.
- `under.png` — place (0, 175.2). Legs on both sides. Sky through the north exit.
- `under-tiltup.png` — pitch 76.40. Shaft overhead.
- `proof.json` — the numbers in the table.

The tilt frame reported drawCalls 9 and videos 1 while the beacon and sky files were not decoded in that instant. The budget row is the sample taken back under the arch: drawCalls 10, videos 4.

qc shots `q6-bolt-height` and `q10-topdown` are posed judge cameras. They are not the walk. `eyes_on` stays a judge line.

Stone and metal use the existing atlas crops, repeated at the tile the phone can hold at the pier face and under the shaft. No new image.

Play URL on this machine: `http://127.0.0.1:8788/packs/zone-b/play/index.html`.
