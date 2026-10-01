# objsheet

Result: **PASS**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## hull-a10

Object **PASS**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `PASS` mean keep `0.9227` min `0.8846` volume `0.3095`
  - yaw-000.png keep `0.926`
  - yaw-045.png keep `0.9286`
  - yaw-090.png keep `0.9318`
  - yaw-135.png keep `0.8924`
  - yaw-180.png keep `0.8846`
  - yaw-225.png keep `0.9423`
  - yaw-270.png keep `0.948`
  - yaw-315.png keep `0.9282`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.0732` height `0.0011` colour `0.9926`
  - yaw-045.png → yaw-090.png area `0.1443` height `0.0539` colour `0.8823`
  - yaw-090.png → yaw-135.png area `0.0251` height `0.0517` colour `0.8866`
  - yaw-135.png → yaw-180.png area `0.0093` height `0.0079` colour `0.9262`
  - yaw-180.png → yaw-225.png area `0.0449` height `0.0067` colour `0.9095`
  - yaw-225.png → yaw-270.png area `0.09` height `0.0135` colour `0.9394`
  - yaw-270.png → yaw-315.png area `0.0826` height `0.0135` colour `0.9313`
  - yaw-315.png → yaw-000.png area `0.0004` height `0.0022` colour `0.9958`
- opposite:
  - yaw-000.png | yaw-180.png width `0.0069` height `0.009`
  - yaw-045.png | yaw-225.png width `0.0012` height `0.0034`
  - yaw-090.png | yaw-270.png width `0.0406` height `0.037`
  - yaw-135.png | yaw-315.png width `0.0069` height `0.0011`

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
