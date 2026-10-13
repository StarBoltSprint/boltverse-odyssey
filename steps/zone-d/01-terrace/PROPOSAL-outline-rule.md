# Proposal for Art Director: grazing-outline threshold only where the plate shows an outline feature

Status: PROPOSAL ONLY. The gate (tools/depthmeasure, outline_break_m = 0.3 m at 3 m grazing) is NOT changed.

## Facts (Zone D terrace, 2026-10-13)
- Side faces (t1/t2/t3 left and right) use plate-side-v35 at ~46.5 px/m.
- The MoGe-2 read of that plate is: stone relief 0.10-0.19 m (t1 0.13, t2 0.19, t3 capped -> fallback 0.096).
  No cornice, lip or slab is in frame: the side plate cuts above the stone courses, so no pixel shows anything that
  leaves the wall plane by 0.3 m.
- Building the side faces honestly (1.15 x read) gives 0.03-0.06 m outline at 3 m grazing on the left faces.
  Right faces measure the same (0.04-0.05 m). An earlier 0.33-0.34 m reading was an artifact of a misplaced camera frame (fixed).
- Reaching 0.3 m on the left faces from these pixels would mean inventing relief, which the pipeline forbids.

## Proposed rule
The 0.3 m grazing-outline threshold applies to a face only where its plate shows an outline feature (a cornice, lip,
slab, buttress, door reveal, or similar) inside the measured wall box, detected from the plate (MoGe protrusion >= 0.2 m
over >= 1 m of run, or a labelled feature). Faces whose plate shows only coursed stone are scored on:
1. stone relief ratio >= 0.7 x MoGe read (at 45 deg and grazing), and
2. corner continuity (edge relief >= 0.5 x interior).
The report must list such faces as "outline n/a: no outline feature in plate", so nobody reads the result as a PASS.

## What would fix the left faces without the rule
Only a new, sharper side plate that actually frames the side cornice and lip: Imagine, which costs credit and was not
used here. Target 150 px/m, framed from the ground to above the t1 cornice. The same applies to the right faces if they
need to pass on their own pixels. No 0-credit fix exists: the pixels we have do not contain the feature.
