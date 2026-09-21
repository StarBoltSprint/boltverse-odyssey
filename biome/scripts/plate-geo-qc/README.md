# plate-geo-qc — law 23

Geometric judge for a Lane Video A. A cold Grok runs this **before hang**. FAIL = recook.

```
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py road-frost.mp4
python3 biome/scripts/plate-geo-qc/plate-geo-qc.py --json empty.mp4 d1.mp4 d2.mp4
```

Needs `ffmpeg`, `numpy`, `Pillow`. Exit 0 = PASS. Exit 1 = FAIL.

Sealed 2026-09-21 on Frost empty KEEP (PASS) vs densify d2 I2V warp (FAIL). Law: [`../../docs/23-plate-geo-qc.md`](../../docs/23-plate-geo-qc.md). Paste: [`../../docs/COLD_START-geo-qc.md`](../../docs/COLD_START-geo-qc.md).
