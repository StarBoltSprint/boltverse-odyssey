# auto.py self-test: 2026-10-10 on the box, Zone B assets

Script: `selftest/auto_st.sh`. Full log: `auto-2026-10-10.log`. The browser stages (shaders, morph, gate) were not run.
Four other executors' headless browsers were running (load ~30), and the box rule is one browser at a time.

| Run | Result |
|---|---|
| tower sections (TEX6 grading) | inputs: 36 cells of 1024² PASS. **grade PASS**: R8 luma atlases + chroma, 60.0 MiB (was 213 MiB as graded RGBA), ΔE mean 0.62 / p99 worst 5.21, **byte-identical to the live `objects1/tex/sec6`** (the generalised scripts reproduce the hand-run TEX6 bake exactly). perf PASS. |
| mesas, reusing the mesa worker's v10 outputs (`strata5raw` 09:14, `strata5` packed) | **inputs NEEDS_IMAGINE**: only 5 distinct wall images (w9≈w1, w10≈w5, w12≈w2; w6 excluded) for 9 needed. A batch of 4 wall-plate requests was written and **not run**. shape PASS (fusion 4.52 % / 10.14 %). **geometry FAIL**: outline IoU 0.874–0.892 PASS on all 9. Repetition 330–1050 group clashes and 58–197 neighbour shares (needs the Imagine plates above). **min px/m 35–61 and max stretch 1.70–9.14 on the worst triangles** (fallen-block rebuild 09:05–09:14; earlier v10 builds read ≥ 58 px/m), so this goes back to the mesa worker. pack PASS. **detail PASS**: grit / scree / sand at 512 px/m, hex lattice peaks 0.004 / 0.003 / 0.002 (background level). stage PASS (staging dir only). perf PASS: start download 6.37 MB gz, LOD0 3.62 MB, detail textures 13.1 MiB; 1.07 M resident tris INFO. |
| mesa built by the tool (L-mid2, 1 seed × 1 salt, ~3 min) | Generator path works end to end: continuous-strata-v10, same shell, **outline IoU 0.894 PASS**. FAIL repetition 252 / neighbours 61 (same plate shortage), min 51.9 px/m, stretch 2.29 on a few lip tris (p01 75.6 px/m). Depth relief was not applied because the search stops before the relief pass when rows fail. |
| perf budget (strata5 + sec6 + `runtime/detail-chunk.js`) | PASS. Detail chunk: 457 SPIR-V instructions, 3 fetch sites, 0 loops. |
| morph scorer (strata4 L-mid captures, re-scored) | PASS: 143 frames, no jump, camera never inside the hull. |
