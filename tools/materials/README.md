# tools/materials — Imagine material library

Every validated tileable Imagine material lives here once and is reused by every zone. Look here **before** asking Imagine for a new tile.

```bash
python3 tools/materials/materials.py find --tag snow                 # by tag
python3 tools/materials/materials.py find --colour '#5a6a90' --status KEEP   # by colour (Lab distance)
python3 tools/materials/materials.py check                           # re-gate every entry
python3 tools/materials/materials.py add --id basalt-zd-frost --albedo tile.jpg --height tile_h.png \
  --key zd-bible-1012/key-zd1-b.jpg --key-ref zd-bible-1012/key-zd1-b.jpg --crop 138,525,478,88 \
  --tile-m 2.0 --tags stone,basalt,zone-d --prompt "<the exact Imagine prompt>" --keep
```

Entry = `library/<id>/` with `albedo.jpg` (Imagine tile, 1024), `height.png` (16-bit, bright = proud), `normal.jpg` (baked from height, OpenGL +Y), `metadata.json`:
source key + crop box, Imagine prompt, `tile_px`, `tile_m`, `px_per_m`, `repeat_period_m`, `dE_vs_key`, `repetition_peak {plain, hex}`, `scene_check`, `status` KEEP/CANDIDATE/FAIL, `date`.

Gates (`check`, exit 1 on any): dE ≤ 5 vs the key crop · px/m ≥ 500 · no scene content (luminance trend ≤ 18 = no sky/horizon, wrap seam ≤ 12) · hex repetition peak ≤ 0.35 **and** below plain tiling. `--keep` only marks KEEP if every gate passes.

Seeded 2026-10-13: `basalt-zd-frost` (dE 3.82, 512 px/m, 2.0 m tile) and `snow-zd-windpacked` (dE 4.25 on a ground snow crop, 853 px/m, 1.2 m tile).

## Honest limits
- dE is mean Lab of the whole tile vs the crop, under flat light. Lit dE is measured in the viewer.
- The scene check is a proxy (gradient + seam). It does not detect a small painted object; eyes still do.
- The repetition peak is measured on a 4×4 bake of the tile (plain vs hex), not on the running game.

## Self-test
```bash
python3 tools/materials/selftest.py
```
