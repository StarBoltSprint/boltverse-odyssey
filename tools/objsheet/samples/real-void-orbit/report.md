# objsheet

Result: **FAIL**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## void-orbit-stills

Object **FAIL**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `FAIL` mean keep `0.7119` min `0.313` volume `0.3138`
  - yaw-000.jpg keep `0.7996`
  - yaw-045.jpg keep `0.7727`
  - yaw-090.jpg keep `0.919`
  - yaw-135.jpg keep `0.9812`
  - yaw-180.jpg keep `0.7634`
  - yaw-225.jpg keep `0.76`
  - yaw-270.jpg keep `0.3866`
  - yaw-315.jpg keep `0.313`
- adjacent:
  - yaw-000.jpg → yaw-045.jpg area `0.0201` height `0.2357` colour `0.9729`
  - yaw-045.jpg → yaw-090.jpg area `0.1666` height `0.1615` colour `0.9798`
  - yaw-090.jpg → yaw-135.jpg area `0.4572` height `0.1927` colour `0.9879`
  - yaw-135.jpg → yaw-180.jpg area `0.6488` height `0.5509` colour `0.8634`
  - yaw-180.jpg → yaw-225.jpg area `0.1104` height `0.0483` colour `0.9917`
  - yaw-225.jpg → yaw-270.jpg area `0.1353` height `0.7803` colour `0.9317`
  - yaw-270.jpg → yaw-315.jpg area `0.2602` height `0.478` colour `0.8237`
  - yaw-315.jpg → yaw-000.jpg area `0.0763` height `0.4055` colour `0.9941`
- opposite:
  - yaw-000.jpg | yaw-180.jpg width `0.0801` height `0.0264`
  - yaw-045.jpg | yaw-225.jpg width `0.1842` height `0.1617`
  - yaw-090.jpg | yaw-270.jpg width `0.5033` height `0.4898`
  - yaw-135.jpg | yaw-315.jpg width `0.5063` height `0.1803`
- FAIL adjacent yaw-000.jpg→yaw-045.jpg height delta=0.236 limit=0.08
- FAIL adjacent yaw-045.jpg→yaw-090.jpg area delta=0.167 limit=0.15
- FAIL adjacent yaw-045.jpg→yaw-090.jpg height delta=0.162 limit=0.08
- FAIL adjacent yaw-090.jpg→yaw-135.jpg area delta=0.457 limit=0.15
- FAIL adjacent yaw-090.jpg→yaw-135.jpg height delta=0.193 limit=0.08
- FAIL adjacent yaw-135.jpg→yaw-180.jpg area delta=0.649 limit=0.15
- FAIL adjacent yaw-135.jpg→yaw-180.jpg height delta=0.551 limit=0.08
- FAIL adjacent yaw-225.jpg→yaw-270.jpg height delta=0.780 limit=0.08
- FAIL adjacent yaw-270.jpg→yaw-315.jpg area delta=0.260 limit=0.15
- FAIL adjacent yaw-270.jpg→yaw-315.jpg height delta=0.478 limit=0.08
- FAIL adjacent yaw-315.jpg→yaw-000.jpg height delta=0.406 limit=0.08
- FAIL opposite yaw-045.jpg|yaw-225.jpg width delta=0.184 limit=0.15
- FAIL opposite yaw-045.jpg|yaw-225.jpg height delta=0.162 limit=0.08
- FAIL opposite yaw-090.jpg|yaw-270.jpg width delta=0.503 limit=0.15
- FAIL opposite yaw-090.jpg|yaw-270.jpg height delta=0.490 limit=0.08
- FAIL opposite yaw-135.jpg|yaw-315.jpg width delta=0.506 limit=0.15
- FAIL opposite yaw-135.jpg|yaw-315.jpg height delta=0.180 limit=0.08
- FAIL hull min keep=0.313 limit=0.7 (views disagree, hull shrinks)
- FAIL hull mean keep=0.712 limit=0.8

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
