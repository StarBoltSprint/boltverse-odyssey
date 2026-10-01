# objsheet

Result: **PASS**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## monolith-a10

Object **PASS**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `PASS` mean keep `0.9902` min `0.9789` volume `0.3436`
  - yaw-000.png keep `0.991`
  - yaw-045.png keep `0.9935`
  - yaw-090.png keep `0.9989`
  - yaw-135.png keep `0.9789`
  - yaw-180.png keep `0.9933`
  - yaw-225.png keep `0.9889`
  - yaw-270.png keep `0.9904`
  - yaw-315.png keep `0.9867`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.0467` height `0.0116` colour `0.9679`
  - yaw-045.png → yaw-090.png area `0.0591` height `0.0037` colour `0.9993`
  - yaw-090.png → yaw-135.png area `0.0994` height `0.0116` colour `0.9942`
  - yaw-135.png → yaw-180.png area `0.0082` height `0.0014` colour `0.9977`
  - yaw-180.png → yaw-225.png area `0.0137` height `0.0014` colour `0.9996`
  - yaw-225.png → yaw-270.png area `0.0461` height `0.016` colour `0.9996`
  - yaw-270.png → yaw-315.png area `0.0213` height `0.0146` colour `0.9998`
  - yaw-315.png → yaw-000.png area `0.0367` height `0.0007` colour `0.9952`
- opposite:
  - yaw-000.png | yaw-180.png width `0.0019` height `0.0022`
  - yaw-045.png | yaw-225.png width `0.0296` height `0.0124`
  - yaw-090.png | yaw-270.png width `0.0596` height `0.0073`
  - yaw-135.png | yaw-315.png width `0.0196` height `0.0043`

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
