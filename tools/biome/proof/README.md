# proof — 2026-10-08 runs (box, CPU only, no Imagine credit spent)

All inputs are Imagine images already made for the game (zone A on main; zone B Ember Mesa test plates on the box).
Hex colours and absolute paths are removed (repo rule 2026-10-03).

| File | What |
|---|---|
| `selftest.json` | `python3 tools/biome/selftest.py`: 32 pass / 0 fail, ~30 s |
| `qc-summary-zoneB.json` | summary of `qc.py check --redact`: 21 zone B plates vs the Ember Mesa proof key still → pass 4 · lut 8 · regenerate 9. Catches the sun plate (H0) as a different look, its seam with H1, the four copied calm slices H2–H5 (duplicate of H1), ground g4, and rock-1 (wrong world for this anchor). |
| `sky-stitch-zoneB.json` | `stitch_sky.py`: 9 calm plates × 44° → 4096×2048 equirect + 8192×1024 band in ~20 s; wrap ΔE 0.04; sun heading measured 86° vs planned 90° |
| `bake-butte-0-stats.json` | `bake_hull.py`: butte, 4 views (front/right/back/top), ~40 s, LOD 3998/799/180, GLB 534 KB, 16.6 % fallback texels (no left / three-quarter views) |
| `bake-boulder-8views-stats.json` | `bake_hull.py`: zone A boulder, 4 ortho + 4 three-quarter, ~108 s, LOD 4000/800/180, GLB 194 KB, 1.07 % fallback, 0 mirrored flanks |

Preview JPGs (stitched sky, bake contact sheets) are not in this PR: the commit went through the GitHub API, which
takes text files only. They stay on the build box.
