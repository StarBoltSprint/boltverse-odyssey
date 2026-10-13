# ADDENDUM (2026-10-13 08:34–08:35 PT) — read before finishing the gate

Art Director has **KEEP**'d S03 and S11 **final4**. Update the gate before you commit.

## Band rule tune (a)/(b)

- Fixture `zd-sky12-S03-final3-fail.jpg` and `zd-sky12-S11-final2-fail.jpg` must still **FAIL**.
- Fixture `zd-sky12-S03-final4-pass.jpg` and `zd-sky12-S11-final4-pass.jpg` (and live final4) must **PASS** the band/lane checks.
- A faint denser diagonal is **acceptable**. Thresholds must sit between final3-fail (clear band) and final4-pass (faint leftover).

## New check (f) — bright edge line (FAIL)

On every plate, look at the top and bottom edges. If any horizontal row in the outer **1–6 px** is much brighter than the rows just inside (e.g. rows 8–16), **FAIL**.
Typical defect: a bright seam / letterbox line from grading.
Run on all 12 live plates with **final4 for S03 and S11**. REPORT must list which plates have an edge line.

## New check (g) — gradient banding (ASTC 4×4, three versions)

In smooth sky areas (low local variance), detect horizontal steps of flat colour (posterization / banding).

Simulate **ASTC 4×4** (not 6×6). Honest approx is fine (e.g. 4×4 block endpoint/palette compression); document it.

Measure banding on **three** versions of each plate:

1. **raw** — the plate pixels as-is
2. **astc4x4** — after the simulated ASTC 4×4 compression
3. **astc4x4_dither1lsb** — after compression, then a **light blue-noise dither of about 1 LSB** applied **after sampling** (this is what the phone shows)

**PASS/FAIL on version 3 only** (phone path). Still **report** risk/metrics for all three.

**Do not bake any dither into the plate files.** Dither exists only in the in-memory phone-path measure. Never write dithered JPGs over the plates; optional debug JPG under `--out` is OK if clearly named `*-phone-path-preview.jpg` and small.

Per plate JSON fields (suggested): `banding_risk_raw`, `banding_risk_astc4x4`, `banding_risk_astc4x4_dither1lsb`, `banding_verdict` (from v3), plus a short note on how much dither would clear residual steps if v3 still bands.

Mild residual on v3 may be report-only; severe obvious steps on v3 may FAIL — tune so final4 + S06–S10 still PASS.

## Self-test table (updated)

| Fixture / case | Expect |
| --- | --- |
| S03-final3-fail | FAIL (band) |
| S11-final2-fail | FAIL (band/lanes) |
| S03-final4-pass | PASS band; (f)/(g) honest |
| S11-final4-pass | PASS band; (f)/(g) honest |
| S06–S10 final3 | PASS |

Live ring: highest finalN; S03/S11 are final4.
