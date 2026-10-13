# tools/10-sky-band-gate — REPORT

Branch `tools/10-sky-band-gate`. Grok Build step was stopped when disk dipped under 2 GB (exit 130); gate implemented locally on the same branch after reclaiming space. No push, no merge, no Imagine.

## Self-test

`python3 tools/sky-band-gate/selftest.py` → **PASS** (exit 0)

| Fixture | Expect | Result |
| --- | --- | --- |
| S03-final3-fail | FAIL band | FAIL (`glow_mw`) |
| S11-final2-fail | FAIL band | FAIL (`tight_mw`) |
| S03-final4-pass | PASS band | PASS |
| S11-final4-pass | PASS band | PASS |
| S06–S10 final3 | PASS band | PASS |

Thresholds sit between final3-fail (clear band) and final4-pass (faint diagonal OK).

## Live ring (highest finalN; S03/S11 = final4)

Source: `steps/tools/10-sky-band-gate/live-ring-report.json`  
Ring median V = **0.422**  
**Edge-line plates: S08 only**

| id | file | status | dens | V | edge | band raw/astc/phone | reasons |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S00 | final2 | FAIL | 1.245 | 0.468 | n | 0.11/0.09/0.13 | mean_V_delta 0.045 |
| S01 | final2 | PASS | 1.242 | 0.426 | n | 0.13/0.09/0.13 | — |
| S02 | final2 | PASS | 1.213 | 0.430 | n | 0.09/0.13/0.13 | — |
| S03 | **final4** | **PASS** | 1.280 | 0.405 | n | 0.02/0.07/0.04 | — |
| S04 | final2 | FAIL | 1.377 | 0.426 | n | 0.00/0.02/0.02 | tight_mw densR=1.377 starR=4.49 nnR=1.0 |
| S05 | final2 | PASS | 1.231 | 0.428 | n | 0.00/0.04/0.07 | — |
| S06 | final3 | PASS | 1.288 | 0.419 | n | 0.00/0.00/0.00 | — |
| S07 | final3 | PASS | 1.276 | 0.412 | n | 0.00/0.02/0.02 | — |
| S08 | final3 | FAIL | 1.366 | 0.410 | **Y** | 0.02/0.00/0.00 | bright_edge_line (2 hits) |
| S09 | final3 | PASS | 1.465 | 0.415 | n | 0.07/0.04/0.02 | — |
| S10 | final3 | PASS | 1.266 | 0.419 | n | 0.00/0.02/0.02 | — |
| S11 | **final4** | **PASS** | 1.356 | 0.422 | n | 0.02/0.00/0.00 | — |

### (f) Bright edge line

Only **S08** fails: bottom rows ~717–718 ratio 1.08, Δ≈3.8 vs inner rows.

### (g) Banding (ASTC 4×4)

Three versions per plate: raw / astc4x4 / astc4x4+~1LSB blue-noise dither after sampling. **PASS/FAIL on phone path only.** Approx: 4×4 block 2 luma endpoints + 2-bit lerp. Dither never written into plate files. All 12 phone-path risks are under the 0.45 fail cut; dither_lsb_to_clear = 1.0 (already cleared at ~1 LSB).

### Live notes for Director / Art Director

- S03/S11 **final4 PASS** the band gate (matches Art Director KEEP).
- S04 final2 trips `tight_mw` (right-side dense clustered stars). Not in the AD final3 FAIL set — flag for a full-size look.
- S00 still bright vs ring (mean V).
- S08 needs edge-line cleanup.

## Deliverables

- `tools/sky-band-gate/` — check.py, selftest.py, measures.py, fixtures/, README.md
- `learn/proposals/sky-band-fullsize-gate.json`
- `steps/tools/10-sky-band-gate/live-ring-report.json` + `live-ring/`

## Kit / disk

- Started via `kit/run-step.sh` at 08:33 PT; stopped at 08:44 PT when free disk hit 1.8 GB (task rule).
- Reclaimed old logs; finished implementation locally with free ≥ 5 GB.
