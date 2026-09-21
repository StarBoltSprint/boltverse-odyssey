# COLD — hazard on the cone (paste before hang of a danger plate)

Read `biome/docs/25-hazard-cone.md`. Camera must already PASS law 23.

```
python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref <empty-KEEP.mp4> --expect 1 <hazard.mp4>
```

`--expect 0` décor · `1` one-lane · `2` two-lane. Exit 0 = hang. Exit 1 = recook the hazard, not empty.

Still KEEP = `IMAGE_0`. Composite the speck far on **one** ray. I2V grows it; L/R stay open. Paste `biome/prompts/camera-1point.txt` + `biome/prompts/hazard-1lane.txt`. NEVER a 3-lane crater / t-shirt / reverse cam.
