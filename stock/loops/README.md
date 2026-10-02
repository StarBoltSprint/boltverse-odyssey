# Living-loop library

Reusable seamless Imagine Video loops: stars, dust, vapor, embers, mist, fireflies, nebula, fog. A file is listed here only after it exists and the checker passes. An empty `loops` array is valid. That is this registry today.

```bash
python3 stock/loops/check.py --registry stock/loops/loops.json --out <dir>
```

Exit **0** when every listed file passes, including when the list is empty. Exit **1** when a seam, a duration, a role, or a decode cost fails. Exit **2** when the command or the JSON is broken.

## Entry

```json
{
  "id": "stars-night",
  "file": "stars-night.mp4",
  "durationSec": 13,
  "seamMAE": null,
  "biomes": ["howling-eclipse"],
  "role": "stars",
  "decodeCost": {}
}
```

| Field | Meaning |
| --- | --- |
| `durationSec` | Declared length. The file must agree within 1.5 s. |
| `seamMAE` | Optional. When it is a number, it must agree with the measured seam within 0.05. `null` means the checker reports the measurement and does not write it back. |
| `biomes` | Kit ids from [`biome/kits/`](../../biome/kits/README.md). Empty means the loop is shared. |
| `role` | `stars`, `dust`, `vapor`, `embers`, `mist`, `fireflies`, `nebula`, `fog`. |
| `decodeCost` | One decoder. `texBytes`, when set, and the file size, both have to stay under 48 MiB (the sky texture cap). The report adds width, height, fps, and pixels per second. |

The seam, pop, and frozen-run rows are `tools/assetcheck` kind `loop` (seam MAE > 8, p95 > 28, flow > 2 px, a pop, a frozen run). Motion MAE above 8, and a rare bright feature on a fixed period under 60 s, are the sky loop rows. A path under `lock/` is refused.

Biome kits name the layers before the file exists (`livingLoops` in the kit). This registry is the file, after the cook.

Self-test: `python3 tools/loops/selftest.py`.
