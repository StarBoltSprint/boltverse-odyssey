# plate-geo-qc — law 23

Geometric judge for a Lane Video A. A cold Grok runs this **before hang**. FAIL = recook.

```
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py road-frost.mp4
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --json empty.mp4 d1.mp4 d2.mp4
```

Needs `ffmpeg`, `numpy`, `Pillow`. Exit 0 = PASS. Exit 1 = FAIL.

Sealed 2026-09-21 on Frost empty KEEP (PASS) vs densify d2 I2V warp (FAIL). Law: [`../../docs/23-plate-geo-qc.md`](../../docs/23-plate-geo-qc.md). Paste: [`../../docs/COLD_START-geo-qc.md`](../../docs/COLD_START-geo-qc.md).

## Rail 12 reports (not the hang gate)

Same script. They do not change the dash thresholds. Long form: [`../../../learn/geometry.md`](../../../learn/geometry.md).

```
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report horizon --image plate.png
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report sky --manifest sky.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report turn --manifest views.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report sun --manifest sun.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report texel --manifest tiles.json
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --report scale --manifest scale.json --bolt
python3 biome/scripts/plate-geo-qc/selftest.py
```

`--report` with plate paths exits 2. A missing plate on the dash path still prints `law 23` and `missing file`.
