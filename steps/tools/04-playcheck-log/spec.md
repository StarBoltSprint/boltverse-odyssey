# tools/04-playcheck-log — compact Grok Build spec

Branch `tools/04-playcheck-log` off a0676f9f. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine.**

Extend `tools/playcheck/` so a play-check run:
1. Uses part collision boxes from library local coords transformed by zone JSON placement (ground snap, clearance under hanging detail).
2. Writes an **approach-run log** (JSONL): timestamp, player position, facing, nearest part id, distance, collision hit/miss, camera layer, fps sample.
3. Flags float (ground_anchor miss), clearance too tight for path, invisible-wall style hits.

Self-test via existing package tests plus a new unit that proves bad collision / float / missing clearance fail; good fixture passes; approach-run log schema validated.

Write `steps/tools/04-playcheck-log/REPORT.md`.

<!-- kit-gate: cd tools/playcheck && npm test -->
<!-- kit-gate-outdir: steps/tools/04-playcheck-log -->

Done when: self-tests exit 0 proving bad output fails; no push/merge.
