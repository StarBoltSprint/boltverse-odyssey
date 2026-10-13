# tools/10-sky-band-gate — REPORT (tightened)

Branch `tools/10-sky-band-gate`. Local only.

## Self-test v2 — PASS

FAIL fixtures (band_fail): S03-final3-fail, S11-final2-fail, S05-final2-fail, S09-final3-fail, S11-final4-fail.  
PASS fixtures (no band_fail): S01, S02, S06–S08, S10.  
Live ring: **PASS**, edge=[], band_fails=[].

New detectors:
- **windowed_haze** — upper-third + right mid windows; skip faint-OK zone (y 40–60%, x 15–30%). FAIL when score≥1.10 and soft_pos≥1.00.
- **narrow_diagonal** — angles 15–45°, half≈0.028; FAIL when abs_ex≥1.90 and er≥1.125.

## Live ring table (highest finalN)

| id | file | status | band_fail | reasons |
|---|---|---|---|---|
| S00–S11 | final5/final4/final3/final2 as present | PASS | no | — |

Art Director KEEP plates that previously failed the old gate (S00 V, S04 tight_mw, S08 edge) are clean on final5.
