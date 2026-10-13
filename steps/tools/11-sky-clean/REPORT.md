# tools/11-sky-clean — REPORT

Branch `tools/11-sky-clean` (from gate tip `8ff4132`). Local only.

## Gate (tools/10-sky-band-gate) — commit `8ff4132`

| plate | fixture / live | want | band_fail | notes |
|---|---|---|---|---|
| S03-final3-fail | fixture | FAIL | yes | glow_mw + narrow |
| S05-final2-fail | fixture | FAIL | yes | windowed_haze |
| S09-final3-fail | fixture | FAIL | yes | narrow_diagonal |
| S11-final2-fail | fixture | FAIL | yes | tight_mw + haze |
| S11-final4-fail | fixture | FAIL | yes | windowed_haze |
| S01/S02/S06–S08/S10 | PASS fixtures | PASS | no | — |
| S00–S11 live highest finalN | KEEP ring | PASS | no | S05 faint haze OK |

Live ring v2: **PASS**, edge=[], band_fails=[].

## sky-clean self-test

| case | result | detail |
|---|---|---|
| clean S05-final2-fail | PASS | 1 pass, haze cleared |
| clean S09-final3-fail | PASS | 1 pass, narrow cleared |
| clean S11-final4-fail | PASS | 2 passes (haze then tight_mw) |
| refuse S09-blotchy-strong | PASS | blotch 2.24 → 5.01, REFUSED_BLOTCH |
| KEEP S05/S09/S11/S08 final5 | PASS | unchanged, maxdiff=0 |

Blotch fixture regenerated at `tools/sky-clean/fixtures/S09-blotchy-strong.jpg`
(and `/workspace/sky-fix-1013/S09-blotchy-strong.jpg`) — stronger thin + patchy bg.
