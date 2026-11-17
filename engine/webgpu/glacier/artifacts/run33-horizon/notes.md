# Run 33 round 2 — corridor stays open

Not a KEEP. Not live. Not merged.

## What changed

The crossing berms are gone. Horizon geometry is fins beside the reachable lat and one ridge at z = -4640, past the course end (`z1` = -4500). `horizon-gate.mjs` now samples the full course, both sides of the lat the player can reach (`max(6, floorHalf - 1.3)`), and fails if any horizon triangle rises more than 0.5 m above the floor there.

Near walls (`distance < 140 m`) sample glacier ice at mip bias 1. Farther walls stay at bias 4 so the repeat does not column. The texel gate still passes, magnification included. Exposure was not touched.

## Gates

| Check | Round 1 | Round 2 | Bar |
| --- | --- | --- | --- |
| corridor hits | 595 (rise 36.7 m at z=-560) | 0 | 0 |
| horizon_closed mcam 0 / 0.9 / 1.57 | 0.9986 / 1 / 1 | 0.8866 / 1 / 1 | ≥ 0.98 |
| right shoulder drop | 0.104 m | 0.104 m | ≤ 0.40 m |
| near sheets / caps | 0 / 0 | 0 / 0 | 0 |
| CPU / page triangles | 199266 / 199898 | 194290 / 194922 | ≤ 197000 CPU |
| draws | 9 | 9 | ≤ 12 |
| texel | PASS, stretch 1.28 | PASS, stretch 1.28 | 2048 px/m |

mcam 0 misses 0.98. The ice walls already fill the eye-level row. Rays that stay inside the reachable lat the whole way still hit those walls, and a fin outside the lat cannot catch them. Covering every outside hit would still leave the row at 0.9485. The 0.9986 figure was the berm that crossed the run. That berm fails the new corridor gate. Both bars are not met together.

Bolt stays at x = 360. Card stays 1.15 m. `chase.mp4` is 720×1280, 8 s, 5 fps, t=22 s to t=30 s. The path in front of him is open.

## Tonemap — still FAIL, not tuned here

The present() grade is being redone on the #239 line (round 3). This round did not change exposure, AgX, or the spec cap. Numbers against the same gamma key:

| Check | Round 2 | Limit |
| --- | --- | --- |
| 11.70 s snow p50 vs the crust still | 0.657 vs 0.708, delta 0.051 | 0.05 |
| 24 s frame p99 | delta 0.0507 | 0.05 |
| 30 s grey_bright | 0.1398 | < 0.15 |

grey_bright is back under the limit once the crossing berm is gone. The other two misses are about 0.001 over. Keyscore 94.20, floor 85.84. CIE76 snow 3.47–5.47, ice 6.19–8.08, all under 10. Clip and crush 0. These two misses depend on the grade round, not on a new exposure.

## Still open

The one-pixel dark row is back in the t=30 chase, because the closure no longer crosses the canyon. mcam 0 horizon_closed is 0.8866. Near wall ice is on the native mip inside 140 m. No KEEP.
