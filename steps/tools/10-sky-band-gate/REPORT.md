# tools/10-sky-band-gate — REPORT (tightened)

Branch `tools/10-sky-band-gate`. Local only. Commit `8ff4132`.

## Self-test v2 — PASS

FAIL fixtures (band_fail): S03-final3-fail, S11-final2-fail, S05-final2-fail, S09-final3-fail, S11-final4-fail.
PASS fixtures (no band_fail): S01, S02, S06–S08, S10.
Live ring: **PASS**, edge=[], band_fails=[].

New detectors:
- **windowed_haze** — upper-third + right mid windows; skip faint-OK zone (y 40–60%, x 15–30%). FAIL when score≥1.10 and soft_pos≥1.00.
- **narrow_diagonal** — angles 15–45°, half≈0.028; FAIL when abs_ex≥1.90 and er≥1.125.

## Live ring table (highest finalN)

| id | file | status | band_fail |
|---|---|---|---|
| S00 | zd-sky12-S00-final5.jpg | PASS | no |
| S01 | zd-sky12-S01-final2.jpg | PASS | no |
| S02 | zd-sky12-S02-final2.jpg | PASS | no |
| S03 | zd-sky12-S03-final4.jpg | PASS | no |
| S04 | zd-sky12-S04-final5.jpg | PASS | no |
| S05 | zd-sky12-S05-final5.jpg | PASS | no (faint haze OK) |
| S06 | zd-sky12-S06-final3.jpg | PASS | no |
| S07 | zd-sky12-S07-final3.jpg | PASS | no |
| S08 | zd-sky12-S08-final5.jpg | PASS | no |
| S09 | zd-sky12-S09-final5.jpg | PASS | no |
| S10 | zd-sky12-S10-final3.jpg | PASS | no |
| S11 | zd-sky12-S11-final5.jpg | PASS | no |

Art Director KEEP on all 12 (final5 for S05/S09/S11). Old saved copies FAIL; live ring PASS.
