# tools/10-sky-band-gate — full-size sky-plate Milky Way / star-band gate

Branch `tools/10-sky-band-gate` off origin/main @ 199aa56. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no Imagine (no image_gen / image_edit / video).** Tools only — do not touch terrace / rune-pillar geometry or regenerate sky plates.

**Disk:** before writing, check `df -Pk /`. If free KB &lt; 2000000 (2 GB), STOP and report. Outputs: **JPG and JSON only** (plus short Markdown REPORT / README). No PNG meshes, no large dumps.

## Goal

Add `tools/sky-band-gate/`: a **local full-size sky-plate gate** that catches leftover Milky Way bands and oversized/undersized star dots that the contact-sheet checks miss. Art Director FAIL on S03 (dense diagonal + snow-noise stars) and S11 (right-side band with dark lanes) is the reason this gate exists.

Prefer a small Python package (measure-only). May read `tools/sky/pixels.py` helpers but do **not** break `tools/sky` APIs. Do not edit live plates under `/workspace/zd-bible-1012/`.

## Plate selection

Live ring dir (read-only): `/workspace/zd-bible-1012/zd-plates/sky12/`

For each `S00`…`S11`, pick the **highest** `finalN` present (`final4` > `final3` > `final2` > `final`), else `graded`, else the bare `zd-sky12-SXX.jpg`.
(Parent brief said prefer final3 when present; Director is now writing final4 for S03/S11 — always take the newest finalN so the live ring reflects the latest grade.)

**Fixtures vs live:** self-tests MUST use the committed FAIL snapshots in `tools/sky-band-gate/fixtures/` (`*-fail.jpg` for S03/S11), not the live dir. Separately run the live dir and report S03/S11 final4 (or newer) status next to the fixture FAIL results.

Plates are full-size stills (current ring is **1280×720**, not 1024 — measure the file as-is). Key B for star-size reference: `tools/sky-band-gate/fixtures/key-zd1-b.jpg` (copy of `/workspace/zd-bible-1012/key-zd1-b.jpg`, 1024×1024). If key B is missing at runtime, **skip** check (c) and record `star_size_vs_keyB: "skipped_no_keyB"` in the JSON.

## FAIL rules (any one fails the plate)

**(a) Dense band strip.** Scan diagonal strip angles (e.g. −50°…+50° in ~5° steps, strip width ~8–12% of the short side). For each angle, measure star density inside the strip vs density in the complementary region (same plate, outside the strip). Pick the densest strip. FAIL if that strip’s density is clearly above the surround (ratio above a tuned threshold — start ~1.25–1.4; tune so fixtures below hold).

**(b) Dark dust lanes.** Inside the densest strip (or a band mask around it), detect dark elongated lanes (local brightness clearly below the strip median, elongated along the strip). FAIL when lanes remain above a small area threshold.

**(c) Median star size &gt; key B.** Detect star blobs (bright local maxima / connected components on a high-percentile mask). Compare median equivalent diameter (px) on the plate to median star diameter on key B’s sky region. FAIL if plate median &gt; key B median × (1 + margin). Scale thresholds if plate resolution ≠ key B (normalize by short-side / 1024, or compare after resizing key B sky crop to plate height). If key B missing → skip and say so.

**(d) Any star &lt; 2 px.** Engine Core floor: after detection, FAIL if any accepted star’s equivalent diameter is under **2.0 px** on the measured plate (mipmaps erase sub-2px dots; dimming is the fine path, not shrinking below 2 px). Tiny single-pixel noise below the star detector threshold is ignored — tune the detector so real star dots are kept.

**(e) Mean V drift.** Convert plate to HSV (or OpenCV HSV), take mean V in [0,1]. Ring median = median of mean V across all 12 selected plates. FAIL if `|meanV − ringMedian| &gt; 0.03`.

## CLI

```bash
python3 tools/sky-band-gate/check.py --plates <dir> --out <reports-dir> [--key-b <jpg>]
python3 tools/sky-band-gate/selftest.py
```

- Exit 0 = all plates PASS (check) / self-tests green.
- Exit 1 = one or more FAIL / self-test failed.
- Exit 2 = bad invocation.
- Write `report.json` + optional contact JPG (small) under `--out`. Per-plate rows: id, path, status, reasons[], metrics (best_angle_deg, density_ratio, dark_lane_score, median_star_px, min_star_px, mean_V, ring_median_V, star_size_vs_keyB).

## Self-tests (must use committed fixtures — Director is re-cleaning live S03/S11)

Fixtures already in `tools/sky-band-gate/fixtures/` (snapshotted before re-clean):

| Fixture | Expect |
| --- | --- |
| `zd-sky12-S03-final3-fail.jpg` | **FAIL** (dense diagonal and/or oversized stars and/or V drift) |
| `zd-sky12-S11-final2-fail.jpg` | **FAIL** (band / dark lanes) |
| `zd-sky12-S06-final3.jpg` … `S10-final3.jpg` | **PASS** |

If expectations do not hold, **tune thresholds honestly** (document before/after in REPORT.md). Do not hardcode plate ids to force FAIL/PASS without measuring.

Also: after self-test, run `check.py` once on the **live** sky12 dir and write results to `steps/tools/10-sky-band-gate/live-ring-report.json`. If Director has already written new S03/S11 (final3 or newer), report those statuses separately from the fixture FAIL cases.

## Proposal

Write `learn/proposals/sky-band-fullsize-gate.json` for the sky recipe (`docs/METHOD/sky.md`):

```json
{
  "schema": "recipe-proposal/1",
  "recipe": "sky",
  "id": "sky-band-fullsize-gate",
  "kind": "param",
  "summary": "Full-size plate gate: densest-angle star-density strip, dark lanes, star size vs key B, min 2 px stars, mean V within 0.03 of ring median.",
  "proven": false,
  "params": {
    "fullSizeBandGate": true,
    "densityRatioMax": <tuned>,
    "minStarPx": 2.0,
    "meanVMaxDelta": 0.03
  }
}
```

Do not edit `docs/METHOD/sky.md`.



## New checks (f) and (g) — READ `ADDENDUM-final4-edge-banding.md`

Art Director KEEP'd S03/S11 **final4**. Fixtures `*-final4-pass.jpg` must **PASS** band checks while `*-fail.jpg` still **FAIL**. Faint denser diagonal = OK.

**(f) Bright edge line (FAIL).** Outer 1–6 px top/bottom row much brighter than rows just inside → FAIL. Run all 12 live plates (final4 for S03/S11). REPORT lists every plate with an edge line.

**(g) Gradient banding (ASTC 4×4, three versions).** In smooth sky, detect horizontal flat-colour steps. Simulate **ASTC 4×4** (document approx). Measure banding on (1) raw, (2) after ASTC 4×4, (3) after ASTC 4×4 + light blue-noise dither ~1 LSB applied after sampling (phone path). **PASS/FAIL on (3) only**; report all three. **Do not bake dither into plate files.** Severe steps on (3) may FAIL; keep final4 + S06–S10 PASS.


Self-test must include final4-pass fixtures as PASS for (a)/(b).

## Deliverables

- `tools/sky-band-gate/` — check.py, selftest.py, pixels/measures module(s), fixtures (already present), README.md
- `learn/proposals/sky-band-fullsize-gate.json`
- `steps/tools/10-sky-band-gate/REPORT.md` — per-plate table (fixtures + live), thresholds, self-test result, live S03/S11 if changed
- Local commit(s) on `tools/10-sky-band-gate`

<!-- kit-gate: python3 tools/sky-band-gate/selftest.py -->
<!-- kit-gate-outdir: steps/tools/10-sky-band-gate -->

## Done when

- Self-tests exit 0: S03-fail + S11-fail FAIL; S06–S10 PASS
- Live ring report JSON written (JPG/JSON only)
- Proposal file present
- REPORT.md filled honestly with commit sha
- No Imagine; no push/merge; stopped if disk &lt; 2 GB free

END: branch, HEAD sha, per-plate table, self-test exit, live S03/S11 status vs fixtures.
