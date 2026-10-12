# tools/03-library-intake — compact Grok Build spec

Branch `tools/03-library-intake` off `a0676f9f` (or merge-base with tools/01-block-library HEAD if library register already exists — prefer a0676f9f + re-apply only if needed; do not push/merge). Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine.** MoGe-2 + SAM2 only.

This is the library-intake refusal follow-up after tools/01-block-library. Extend `tools/library/` intake so a part is refused unless ALL of the following hold. Each refusal needs a self-test that proves a bad fixture fails.

## Intake requirements (all mandatory)
1. **Art Director KEEP** recorded (status field / gate report KEEP flag — fixture may stub `art_director: "KEEP"`).
2. **Run PASS** (object-gate / tools/gate verdict PASS). Visual KEEP alone is not enough.
3. **Collision boxes** in the part's **local coordinates**, plus `ground_anchor` and `min_clearance_m` under any hanging detail.
4. **Camera layer** stored on the part (key / approach layer id as used by play-check).
5. **Full LOD chain** (lod0/1/2) with **0 px outline difference** at 15 m and 40 m switches; store **triangle count per LOD**.
6. **Textures** ≥ 1024 native Imagine pixels with mipmaps.

## Self-test
`python3 tools/library/selftest_intake.py` (or extend `tools/library/selftest.py`) exits 0 and proves each refusal:
| Bad fixture | Expect refuse |
|---|---|
| KEEP but run FAIL | refuse |
| run PASS but no KEEP | refuse |
| missing local collision boxes / ground_anchor / clearance | refuse |
| missing camera layer | refuse |
| LOD outline diff > 0 at 15 or 40 m | refuse |
| missing per-LOD tri counts | refuse |
| texture < 1024 or no mipmaps | refuse |
| all fields good | accept |

Write `steps/tools/03-library-intake/REPORT.md`.

<!-- kit-gate: python3 tools/library/selftest.py -->
<!-- kit-gate-outdir: steps/tools/03-library-intake -->

Done when: self-tests exit 0; no push/merge; REPORT filled.
