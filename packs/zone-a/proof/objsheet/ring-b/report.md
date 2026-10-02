# objsheet

Result: **PASS**

A hand-written PASS is not a PASS. Paste this file with the sheet PNG.

## ring-b

Object **PASS**.

- silhouette: `PASS`
- ring: `PASS` yaws `[0, 45, 90, 135, 180, 225, 270, 315]`
- guide: `SKIP` limit 0.97
- hull: `PASS` mean keep `0.8024` min `0.7541` volume `0.7827`
  - yaw-000.png keep `0.7541`
  - yaw-045.png keep `0.8225`
  - yaw-090.png keep `0.7594`
  - yaw-135.png keep `0.8531`
  - yaw-180.png keep `0.7588`
  - yaw-225.png keep `0.8212`
  - yaw-270.png keep `0.8005`
  - yaw-315.png keep `0.8496`
- adjacent:
  - yaw-000.png → yaw-045.png area `0.0254` height `0.0011` colour `0.9983`
  - yaw-045.png → yaw-090.png area `0.0495` height `0.0043` colour `0.9959`
  - yaw-090.png → yaw-135.png area `0.0188` height `0.0172` colour `0.987`
  - yaw-135.png → yaw-180.png area `0.0906` height `0.014` colour `0.9911`
  - yaw-180.png → yaw-225.png area `0.0591` height `0.0085` colour `0.9842`
  - yaw-225.png → yaw-270.png area `0.0765` height `0.0053` colour `0.9914`
  - yaw-270.png → yaw-315.png area `0.0897` height `0.0107` colour `0.9947`
  - yaw-315.png → yaw-000.png area `0.0501` height `0.0139` colour `0.9913`
- opposite:
  - yaw-000.png | yaw-180.png width `0.0207` height `0.0064`
  - yaw-045.png | yaw-225.png width `0.0229` height `0.0011`
  - yaw-090.png | yaw-270.png width `0.0109` height `0.0`
  - yaw-135.png | yaw-315.png width `0.011` height `0.0065`

## Heuristics

- The sheet is a proof. It is not an Imagine asset and it must not be hung or sampled as a texture.
- Silhouette IoU against a guide is the strict identity check (limit 0.97) and runs only when a guide is given.
- Adjacent area ±15% and height ±8% match the walk-around silhouette lock.
- Opposite views are compared on width and height, not as a pixel mirror. An asymmetric part can fail the width band.
- Colour histogram correlation is a weak identity test. A different facing colour can score low. The silhouette numbers are the gate.
- Hull keep is a coarse 7-of-8 voxel carve (grid 32), ray-marched back into each mask. It is not the smooth surface-nets mesh.
- Views that disagree shrink that carve toward a blob, and the keep fraction falls.
- A hand-written PASS is not a PASS. Paste report.json and the sheet PNG.
