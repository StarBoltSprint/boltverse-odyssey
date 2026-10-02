# objsheet

Result: **FAIL**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## inconsistent

Object **FAIL**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `PASS` mean keep `0.9194` min `0.8342` volume `0.2489`
- margin: `PASS` minFrac `0.045` maxEdge `200`
- holes: `PASS` max interior `0.0`
  - yaw-000.png keep `0.8342`
  - yaw-045.png keep `0.9808`
  - yaw-090.png keep `1.0`
  - yaw-135.png keep `0.8546`
  - yaw-180.png keep `0.8529`
  - yaw-225.png keep `0.981`
  - yaw-270.png keep `0.9972`
  - yaw-315.png keep `0.8545`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.0535` height `0.0` colour `0.6727`
  - yaw-045.png → yaw-090.png area `0.0475` height `0.0` colour `0.6501`
  - yaw-090.png → yaw-135.png area `0.6396` height `0.2839` colour `-0.0073`
  - yaw-135.png → yaw-180.png area `0.0` height `0.0` colour `1.0`
  - yaw-180.png → yaw-225.png area `0.6895` height `0.2839` colour `-0.0063`
  - yaw-225.png → yaw-270.png area `0.0695` height `0.0` colour `0.646`
  - yaw-270.png → yaw-315.png area `0.0695` height `0.0` colour `0.6176`
  - yaw-315.png → yaw-000.png area `0.045` height `0.0` colour `0.8367`
- opposite:
  - yaw-000.png | yaw-180.png width `0.9353` height `0.2839`
  - yaw-045.png | yaw-225.png width `0.0103` height `0.0`
  - yaw-090.png | yaw-270.png width `0.022` height `0.0`
  - yaw-135.png | yaw-315.png width `0.9037` height `0.2839`
- FAIL adjacent yaw-090.png→yaw-135.png area delta=0.640 limit=0.15
- FAIL adjacent yaw-090.png→yaw-135.png height delta=0.284 limit=0.08
- FAIL colour yaw-090.png→yaw-135.png corr=-0.007 dist=147.3
- FAIL adjacent yaw-180.png→yaw-225.png area delta=0.689 limit=0.15
- FAIL adjacent yaw-180.png→yaw-225.png height delta=0.284 limit=0.08
- FAIL colour yaw-180.png→yaw-225.png corr=-0.006 dist=228.8
- FAIL opposite yaw-000.png|yaw-180.png width delta=0.935 limit=0.15
- FAIL opposite yaw-000.png|yaw-180.png height delta=0.284 limit=0.08
- FAIL opposite yaw-135.png|yaw-315.png width delta=0.904 limit=0.15
- FAIL opposite yaw-135.png|yaw-315.png height delta=0.284 limit=0.08

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
