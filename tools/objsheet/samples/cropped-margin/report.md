# objsheet

Result: **FAIL**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## cropped-margin

Object **FAIL**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `FAIL` mean keep `0.7944` min `0.7894` volume `0.1155`
- margin: `FAIL` minFrac `0.0` maxEdge `200`
- holes: `PASS` max interior `0.0`
  - yaw-000.png keep `0.796`
  - yaw-045.png keep `0.7894`
  - yaw-090.png keep `0.796`
  - yaw-135.png keep `0.796`
  - yaw-180.png keep `0.796`
  - yaw-225.png keep `0.7894`
  - yaw-270.png keep `0.796`
  - yaw-315.png keep `0.796`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.0` height `0.0` colour `1.0`
  - yaw-045.png → yaw-090.png area `0.0` height `0.0` colour `1.0`
  - yaw-090.png → yaw-135.png area `0.0` height `0.0` colour `1.0`
  - yaw-135.png → yaw-180.png area `0.0` height `0.0` colour `1.0`
  - yaw-180.png → yaw-225.png area `0.0` height `0.0` colour `1.0`
  - yaw-225.png → yaw-270.png area `0.0` height `0.0` colour `1.0`
  - yaw-270.png → yaw-315.png area `0.0` height `0.0` colour `1.0`
  - yaw-315.png → yaw-000.png area `0.0` height `0.0` colour `1.0`
- opposite:
  - yaw-000.png | yaw-180.png width `0.0` height `0.0`
  - yaw-045.png | yaw-225.png width `0.0` height `0.0`
  - yaw-090.png | yaw-270.png width `0.0` height `0.0`
  - yaw-135.png | yaw-315.png width `0.0` height `0.0`
- FAIL hull mean keep=0.794 limit=0.8
- FAIL margin yaw-000.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)
- FAIL margin yaw-045.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)
- FAIL margin yaw-090.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)
- FAIL margin yaw-135.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)
- FAIL margin yaw-180.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)
- FAIL margin yaw-225.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)
- FAIL margin yaw-270.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)
- FAIL margin yaw-315.png top=0px minFrac=0.0000 limit=0.03 (cropped views carve the hull)

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A silhouette that comes within 3% of any frame edge is cropped. Cropped views carve the hull. The margin is measured on the unfilled mask.
- Interior holes are transparent pixels enclosed by the silhouette, as a fraction of interior pixels. Above 0.2% the stone is see-through. The tool does not fill those pixels.
- Width and height are read from the file. A still over 2048 px on a side fails.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
