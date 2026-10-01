# objsheet

Result: **FAIL**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## bad-guide

Object **FAIL**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `FAIL` limit 0.97
  - yaw-000.png IoU `0.5427`
  - yaw-045.png IoU `0.5231`
  - yaw-090.png IoU `0.5066`
  - yaw-135.png IoU `0.5231`
  - yaw-180.png IoU `0.5427`
  - yaw-225.png IoU `0.5274`
  - yaw-270.png IoU `0.5006`
  - yaw-315.png IoU `0.5274`
- hull: `PASS` mean keep `0.9971` min `0.9939` volume `0.3951`
  - yaw-000.png keep `0.9975`
  - yaw-045.png keep `0.9939`
  - yaw-090.png keep `1.0`
  - yaw-135.png keep `0.9974`
  - yaw-180.png keep `0.995`
  - yaw-225.png keep `0.9965`
  - yaw-270.png keep `0.9991`
  - yaw-315.png keep `0.9974`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.0535` height `0.0` colour `0.6727`
  - yaw-045.png → yaw-090.png area `0.0475` height `0.0` colour `0.6501`
  - yaw-090.png → yaw-135.png area `0.0475` height `0.0` colour `0.6866`
  - yaw-135.png → yaw-180.png area `0.0535` height `0.0` colour `0.6715`
  - yaw-180.png → yaw-225.png area `0.045` height `0.0` colour `0.8009`
  - yaw-225.png → yaw-270.png area `0.0695` height `0.0` colour `0.646`
  - yaw-270.png → yaw-315.png area `0.0695` height `0.0` colour `0.6176`
  - yaw-315.png → yaw-000.png area `0.045` height `0.0` colour `0.8367`
- opposite:
  - yaw-000.png | yaw-180.png width `0.0` height `0.0`
  - yaw-045.png | yaw-225.png width `0.0103` height `0.0`
  - yaw-090.png | yaw-270.png width `0.022` height `0.0`
  - yaw-135.png | yaw-315.png width `0.0103` height `0.0`
- FAIL guide yaw-000.png IoU=0.5427 limit=0.97
- FAIL guide yaw-045.png IoU=0.5231 limit=0.97
- FAIL guide yaw-090.png IoU=0.5066 limit=0.97
- FAIL guide yaw-135.png IoU=0.5231 limit=0.97
- FAIL guide yaw-180.png IoU=0.5427 limit=0.97
- FAIL guide yaw-225.png IoU=0.5274 limit=0.97
- FAIL guide yaw-270.png IoU=0.5006 limit=0.97
- FAIL guide yaw-315.png IoU=0.5274 limit=0.97

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
