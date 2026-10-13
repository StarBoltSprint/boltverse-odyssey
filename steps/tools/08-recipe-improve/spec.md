# tools/08-recipe-improve — compact Grok Build spec

Branch `tools/08-recipe-improve` off 99346a47 (or newer origin/main). Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine. Do NOT edit docs/METHOD directly.**

Tool `recipe-improve` (prefer new package `tools/recipe-improve/`): for any build that uses a `docs/METHOD` recipe, A/B the **current recipe** vs **one candidate variant**.

## Behaviour

1. **Inputs:** recipe id (e.g. `ground`, `sky`), same cook inputs (plates / kit / scene fixtures), and one candidate from bot proposals as a patch or param file under `learn/proposals/` (create the dir + README if missing; example fixture proposals for self-tests).
2. **Run both:** apply current recipe baseline, then apply the candidate variant, on the **same** inputs. No docs/METHOD mutation — variants are overlays (patch/param) only.
3. **Score both** with:
   - object-gate gates API JSON (`tools/object-gate`, report JSON shape / verdict + per-check rows);
   - shot-sheet verdict renders (`tools/objsheet` verdict JSON when available);
   - `__perfReport` / phone-perf rows when available (`perfRows` / fixture).
4. **Decision:** keep the winner **only if** it is **strictly better** on the aggregate score **and** has **zero regression** on any blocking check vs current. Otherwise keep the current recipe.
   - Blocking-check regression → reject variant even if total score is higher.
   - Tie (equal score, no regression) → reject variant (keep current).
5. **Outputs:** never edit `docs/METHOD`. On a win, emit a proposed patch under `learn/proposals/` (or `learn/recipe-improve/`) flagged `proven: true` for Director to fold into METHOD. Log **every** comparison in `learn/` as JSON + short md: inputs, both scores, per-check diff, decision (`keep_current` | `adopt_variant`).

## Self-tests (must prove)

- Variant with **one regressed blocking check** is rejected even if its total score is higher.
- **Tied** variant is rejected (keep current).
- **Strictly better** variant (higher score, zero blocking regressions) wins; emits `proven` proposal.
- Comparison **logs** are written (JSON + md) for each case.

Write `steps/tools/08-recipe-improve/REPORT.md` with package choice and how score / blocking are defined.

<!-- kit-gate: node tools/recipe-improve/selftest.mjs -->
<!-- kit-gate-outdir: steps/tools/08-recipe-improve -->

Done when: self-tests exit 0 proving reject-on-regression, reject-on-tie, adopt-when-strictly-better, and logs written; no push/merge; docs/METHOD untouched.
