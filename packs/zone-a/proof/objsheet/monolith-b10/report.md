# objsheet

Result: **PASS**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## monolith-b10

Object **PASS**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `PASS` mean keep `0.9909` min `0.9859` volume `0.4282`
  - yaw-000.png keep `0.9879`
  - yaw-045.png keep `0.9994`
  - yaw-090.png keep `0.9859`
  - yaw-135.png keep `0.9874`
  - yaw-180.png keep `0.9977`
  - yaw-225.png keep `0.9912`
  - yaw-270.png keep `0.9895`
  - yaw-315.png keep `0.9879`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.1185` height `0.0143` colour `0.9849`
  - yaw-045.png → yaw-090.png area `0.0523` height `0.0271` colour `0.9947`
  - yaw-090.png → yaw-135.png area `0.0181` height `0.0077` colour `0.9952`
  - yaw-135.png → yaw-180.png area `0.0312` height `0.0103` colour `0.9888`
  - yaw-180.png → yaw-225.png area `0.0555` height `0.0065` colour `0.9969`
  - yaw-225.png → yaw-270.png area `0.004` height `0.0013` colour `0.9992`
  - yaw-270.png → yaw-315.png area `0.0061` height `0.0` colour `0.999`
  - yaw-315.png → yaw-000.png area `0.0045` height `0.0026` colour `0.988`
- opposite:
  - yaw-000.png | yaw-180.png width `0.0484` height `0.0052`
  - yaw-045.png | yaw-225.png width `0.1105` height `0.0156`
  - yaw-090.png | yaw-270.png width `0.0768` height `0.0102`
  - yaw-135.png | yaw-315.png width `0.0927` height `0.0026`

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
