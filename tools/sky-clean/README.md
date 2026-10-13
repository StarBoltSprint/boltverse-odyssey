# tools/sky-clean

Local cleaner for sky plates that fail `tools/sky-band-gate`.

## Flow

1. Run the band gate on the input JPG.
2. If `band_fail`, build clean polygons only from failing detectors
   (`windowed_haze` box, `narrow_diagonal` strip, `glow_mw` / `tight_mw` strip).
3. Apply the `fix2.py` algorithm (masked bg column-fill + star thinning).
4. Re-run the gate.
5. Stop when the plate PASSes, or when **blotchiness** (mean local variance of
   the background luma, upper half) **rises**.

## CLI

```bash
python3 tools/sky-clean/clean.py --in plate.jpg --out out.jpg [--max-passes 4] [--report r.json]
python3 tools/sky-clean/selftest.py
```

## Self-test

- Cleans saved old S05-final2 / S09-final3 / S11-final4 fail fixtures to PASS.
- Refuses the blotchy stronger-S09 fixture (`fixtures/S09-blotchy-strong.jpg`).
- Leaves Art Director KEEP plates unchanged (`unchanged=True`, pixel maxdiff 0).

Branch: `tools/11-sky-clean`. Local only — no push / merge / Imagine.
