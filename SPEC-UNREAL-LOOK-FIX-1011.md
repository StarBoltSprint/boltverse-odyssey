# Unreal-look fix pass (11 Oct)
Read /workspace/zb-unreal-look-1011/REPORT.md and feedback/2026-10-11-look-grade-distance.md. The gates passed, but the look is wrong. The grade is too dark (mean luma 0.227 against the key's 0.321), the god rays are crushed, the key camera doesn't match key-city3, and the tower contact shadows are gone.
1. Gate gap first: add BLOCKING checks. Luma mean and histogram within ±10% of the key, measured on a REAL game frame from the matched key camera (no synthetic pregrade). God-ray visibility must stay above a threshold. Contact shadows must exist at the tower feet.
2. Match the key camera to key-city3 (reuse the auto-placement camera match, if one exists).
3. Fit the grade against that real frame until the new checks pass. Keep the god rays and add back the static baked contact shadows.
4. Build the before / after / key sheet for the phone (540x1200). Local commits only; generate no Imagine images (bake-sand stays pending).
Stop when every check passes, or after 2 fit rounds with an honest report.
