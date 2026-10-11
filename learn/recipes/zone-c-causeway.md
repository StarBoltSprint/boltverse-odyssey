# terrain — Zone C causeway

Status: blocking rows cleared. The step verdict is OPEN. Far UV stretch is not a pass. No Imagine prompt.

| Field | Value |
| --- | --- |
| Asset kind | terrain |
| Take | zc/03-terrain |
| Commit | `fbd65e61` |
| Date | 2026-10-11 |
| Size | key 1792×1008; grid 113×205 at 0.5 m |
| Tries | 2 relief gains inside one tool run |
| CLI | none (no Imagine) |
| Image refs | existing `key-zc1.jpg` and `packs/zone-a/src/ground/m0–m3.png` |

## Prompt

```
not stored
```

No new image was requested.

## QC rows passed

| Command | Row | Numbers |
| --- | --- | --- |
| `run.py --zone c` | pathIoU | 0.7704 (need ≥ 0.75). Gain 1.0 was 0.5044 and was not kept. |
| `run.py --zone c` | corridor | max slope 15.5°, min width 2.0 m, relief 0.319 m, cliffs off the support 0 |
| `run.py --zone c` | lodPopIoU | 0.9248 at the key; 0.9591 / 0.9527 / 0.9525 at +8 / +30 / +60 m |
| headless capture | draw calls / triangles | 1 draw; 45696 near, 14720 mid, 5900 far |
| `run.py --zone c` | uvStretch | p95 1.252 / 16.707 / 74.136 / 93.095. Open. Not a pass. |
| `run.py --zone c` | dav2 | spearman 0.9979 on 29554 causeway pixels. Cached. Not shipped. |

## Do not

Run the Zone B skyline composer on this key. Do not stride the path mask and call it an LOD. Do not grow cliffs from the heightfield.
