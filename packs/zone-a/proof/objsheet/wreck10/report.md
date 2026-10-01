# objsheet

Result: **FAIL**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## wreck10

Object **FAIL**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `FAIL` mean keep `0.7856` min `0.7263` volume `0.7853`
  - yaw-000.png keep `0.8232`
  - yaw-045.png keep `0.7604`
  - yaw-090.png keep `0.7898`
  - yaw-135.png keep `0.7643`
  - yaw-180.png keep `0.8447`
  - yaw-225.png keep `0.7263`
  - yaw-270.png keep `0.8122`
  - yaw-315.png keep `0.764`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.0928` height `0.011` colour `0.9953`
  - yaw-045.png → yaw-090.png area `0.0133` height `0.007` colour `0.996`
  - yaw-090.png → yaw-135.png area `0.0263` height `0.0121` colour `0.9781`
  - yaw-135.png → yaw-180.png area `0.1385` height `0.006` colour `0.9791`
  - yaw-180.png → yaw-225.png area `0.1352` height `0.002` colour `0.8608`
  - yaw-225.png → yaw-270.png area `0.0551` height `0.001` colour `0.9714`
  - yaw-270.png → yaw-315.png area `0.0187` height `0.016` colour `0.9833`
  - yaw-315.png → yaw-000.png area `0.0928` height `0.011` colour `0.9953`
- opposite:
  - yaw-000.png | yaw-180.png width `0.0054` height `0.002`
  - yaw-045.png | yaw-225.png width `0.0723` height `0.015`
  - yaw-090.png | yaw-270.png width `0.0654` height `0.009`
  - yaw-135.png | yaw-315.png width `0.0122` height `0.019`
- FAIL hull mean keep=0.786 limit=0.8

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
