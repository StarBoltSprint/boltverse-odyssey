# sky-band-gate

Full-size sky-plate gate for leftover Milky Way bands, bright edge lines, and ASTC banding.

```bash
python3 tools/sky-band-gate/check.py --plates /workspace/zd-bible-1012/zd-plates/sky12 --out /tmp/sky-band
python3 tools/sky-band-gate/selftest.py
```

Exit 0 = PASS. Exit 1 = FAIL. Exit 2 = bad invocation / disk &lt; 2 GB.

## Checks

| id | FAIL when |
| --- | --- |
| (a)/(b) band | **glow_mw**: densest-strip density ≥ 1.30 and soft ridge ≥ 0.40 and star NN ≤ 12; or **tight_mw** (right half): density ≥ 1.25 and star_ratio ≥ 1.80 and NN ≤ 4 |
| (c) star size | median DoG star diameter &gt; key B × 1.35 |
| (d) min 2 px | advisory `frac_stars_under_2px`; FAIL only if median &lt; 1.20 (corrupt shrink). Engine Core floor is a grading rule; DoG on 1280×720 labels many 1 px peaks |
| (e) mean V | \|mean V − ring median\| &gt; 0.03 |
| (f) edge line | any of outer 1–6 px rows (top/bottom) ratio ≥ 1.045 and Δ ≥ 2.5 vs rows just inside |
| (g) banding | risk on **phone path** (ASTC 4×4 approx + ~1 LSB blue-noise dither after sampling) ≥ 0.45. Raw and compressed risks are reported. Dither is never baked into plates |

Fixtures under `fixtures/` snapshot S03/S11 pre-final4 FAIL plates and final4 PASS plates.
