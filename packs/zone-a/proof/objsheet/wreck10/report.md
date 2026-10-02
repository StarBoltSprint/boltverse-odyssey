# objsheet

Result: **PASS**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## wreck10

Object **PASS**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `PASS` mean keep `0.8604` min `0.8053` volume `0.4942`
  - yaw-000.png keep `0.8628`
  - yaw-045.png keep `0.9033`
  - yaw-090.png keep `0.8516`
  - yaw-135.png keep `0.826`
  - yaw-180.png keep `0.8053`
  - yaw-225.png keep `0.8645`
  - yaw-270.png keep `0.868`
  - yaw-315.png keep `0.9015`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.092` height `0.0205` colour `0.9974`
  - yaw-045.png → yaw-090.png area `0.1323` height `0.0488` colour `0.9987`
  - yaw-090.png → yaw-135.png area `0.063` height `0.0235` colour `0.9349`
  - yaw-135.png → yaw-180.png area `0.031` height `0.0293` colour `0.9442`
  - yaw-180.png → yaw-225.png area `0.1374` height `0.0258` colour `0.9436`
  - yaw-225.png → yaw-270.png area `0.1353` height `0.0621` colour `0.982`
  - yaw-270.png → yaw-315.png area `0.0775` height `0.068` colour `0.9593`
  - yaw-315.png → yaw-000.png area `0.0713` height `0.0024` colour `0.955`
- opposite:
  - yaw-000.png | yaw-180.png width `0.071` height `0.0341`
  - yaw-045.png | yaw-225.png width `0.0543` height `0.0289`
  - yaw-090.png | yaw-270.png width `0.0186` height `0.0421`
  - yaw-135.png | yaw-315.png width `0.1284` height `0.0024`

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
