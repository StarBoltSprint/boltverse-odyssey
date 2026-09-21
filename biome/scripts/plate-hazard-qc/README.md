# plate-hazard-qc — law 25

Hazard-on-cone judge. Run **after** law 23 (camera PASS), **before** hang.

```
python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 0 d1.mp4
python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 1 d2.mp4
```

`--expect 0` décor · `1` one-lane meteor · `2` two-lane. Exit 0 = PASS. Exit 1 = FAIL.

Sealed 2026-09-21: empty PASS · d1 décor wash WARN · d2 meteor 3-lane wall FAIL. Law: [`../../docs/25-hazard-cone.md`](../../docs/25-hazard-cone.md).
