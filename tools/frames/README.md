# Frame checks

Proof-shot measurements for any biome. The functions read pixels. They do not draw, grade, or replace a pixel.

```bash
python3 tools/frames/selftest.py
python3 tools/frames/check.py --image shot.jpg::sky --out /tmp/frames.md
python3 tools/frames/check.py --list shots.txt --brief BRIEF.md --shows shows.json \
  --ruins packs/<pack>/src/ruins/manifest.json --proof proof.json \
  --out report.md --progress report.progress.json --resume
```

`--image` is `path` or `path::role`. A role is `sky`, `ground`, `scene`, or `all`. Prefix `historical:` to report a frame without failing the exit code. `--list` is one spec per line. `--resume` skips ids already in the progress file and rewrites the report after each image.

| Check | Fail |
|---|---|
| `foot_contact` | Sky-coloured pixels between a solid and the ground in the same columns. A distant skyline that meets the ground does not fail. |
| `untextured` | A large black or flat untextured region. A full-width night band that touches the top is ignored. This does not replace playcheck `black_regions`. |
| `sky_frame` | A flat zenith band, a vertical streak, a tall seam, a slice rectangle, or two overlapping panels. Any biome. |
| `ground_frame` | A hard horizontal line with a flat side, or a void band under the relief. |
| `stair_crown` | A silhouette crown made of long flat steps. The detail names a finer loft grid, a smoother silhouette, and a recook at the on-screen pixel count. |
| `heroes` | Each line under `## Must show` or `## Heroes` needs a box in `shows.json` that is not flat or empty. No such heading is `n/a`. |
| `mag_hotspots` | A proof-camera distance where the best density for that part is still above 1. The detail names the farther camera, the smaller scale, and the recook. It does not enlarge a texture. |
| `seat_foot_gap` | `INFO`. The manifest foot gap is the skirt drop. It is not the framebuffer row. |

Exit 0 when no current row is `FAIL`. Exit 1 when one is. `n/a`, `INFO`, and `HISTORICAL` do not fail the run.
