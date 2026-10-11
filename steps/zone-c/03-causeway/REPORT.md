# Zone C — causeway only

The walkable deck, and nothing else. The Zone B skyline composer is not run: it would build 15–30 m banks, and those cliffs are solids.

Camera lock from the MoGe-2 deck plane: vertical field 51.47°, pitch +7.95°, eye 1.508 m.

| Measure | Value |
|---|---|
| Mask pixels on the plane | 1.00 |
| Width, median | 3.20 m |
| Width, 10th–90th | 1.77 m – 6.45 m |
| Depth | 4.73 m to 16.31 m |
| Footprint | 7.00 m by 11.53 m |
| Slope | 0° |
| Vertices / triangles | 2393 / 4498 |

The width swings because the leaves pinch the near ribbon and the far lip is wider. Height is the plane. No invented relief.

```bash
python3 tools/terrain-from-key/causeway_field.py \
  --image key-zc1.jpg --mask steps/zone-c/02-masks/mask-causeway.png \
  --out steps/zone-c/03-causeway
```
