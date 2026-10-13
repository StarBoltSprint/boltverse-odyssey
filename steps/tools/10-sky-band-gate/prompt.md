TOOLS/10-SKY-BAND-GATE — implement the compact spec on Grok Build's quota.
Read GROK.md and steps/tools/10-sky-band-gate/spec.md first.
Build tools/sky-band-gate: full-size sky-plate gate (dense diagonal band, dark lanes, star size vs key B, min 2 px stars, mean V within 0.03 of ring median). Fixtures already in tools/sky-band-gate/fixtures/ (S03/S11 FAIL snapshots + S06–S10 PASS). Self-tests must use those fixtures. Also run check on live /workspace/zd-bible-1012/zd-plates/sky12/ and report if Director's re-cleaned S03/S11 now PASS. Write learn/proposals/sky-band-fullsize-gate.json. JPG/JSON outputs only; stop if disk < 2 GB free. No Imagine, no push/merge. End with REPORT.md.

ADDENDUM: Read steps/tools/10-sky-band-gate/ADDENDUM-final4-edge-banding.md and tools/sky-band-gate/ADDENDUM.md before finishing. Tune band so final3-fail FAILs and final4-pass PASSes. Add (f) bright edge line and (g) gradient banding + ASTC4x4 approx. Live ring uses final4 for S03/S11.

(g) UPDATE: ASTC 4x4 (not 6x6). Banding on raw / compressed / compressed+~1LSB blue-noise dither after sampling. PASS/FAIL on the third (phone path). Do not bake dither into plates.
