# COLD — m densify snowball

Read `biome/docs/22-m-densify-snowball.md`.

Same biome. **Base plate fixed** (first=last loop). Success → +1 décor ref **and keep all older** (snowball, ≤12). Miss → −1 tier. Details in perfect biome harmony; hazards stay. Never morph road / Bolt. REUSE 6s + GPU.

Frost: hang ADD `road-frost-d1.mp4`. Never overwrite `road-frost.mp4`. GPU KEEP file is `22-gpu24-frost-keep.md` (same number, different law).

**Before hang densify:** `python3 biome/scripts/plate-geo-qc/plate-geo-qc.py <dN.mp4>` must PASS (law 23). If the plate has a danger: `python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref road-frost.mp4 --expect 1 <dN.mp4>` (law 25). FAIL = recook. Empty KEEP is the camera teacher. Paste `biome/prompts/camera-1point.txt` + `biome/prompts/hazard-1lane.txt` on the I2V.
