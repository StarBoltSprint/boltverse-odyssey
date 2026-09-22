# plate-mae-qc — law 33

Seam judge. Last frame of plate N vs first frame of plate N+1. A cold Grok runs this **before hang** of a chained Video A. FAIL = recook the seam.

```
python3 biome/scripts/plate-mae-qc/plate-mae-qc.py road-N.mp4 road-N1.mp4
python3 biome/scripts/plate-mae-qc/plate-mae-qc.py --json a.mp4 b.mp4 c.mp4
```

Needs `ffmpeg`, `numpy`, `Pillow`. Exit 0 = PASS. Exit non-zero = FAIL.

Checks full-frame RGB MAE, asphalt-band luma MAE, and white-balance `|Δ(R−B)|`. One plate is not a seam — that call FAILs. Law: [`../../docs/33-plate-mae-qc.md`](../../docs/33-plate-mae-qc.md). Paste: [`../../docs/COLD_START-plate-mae.md`](../../docs/COLD_START-plate-mae.md).
