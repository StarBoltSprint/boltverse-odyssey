# tools/02-gates-api — compact Grok Build spec

Branch `tools/02-gates-api` off `zd/01-terrace` @ a0676f9f. Work only in this worktree. Local commits OK. **No push, no merge, no reset --hard, no new Imagine generation.** MoGe-2 + SAM2 only; relief only under its own pixels; native 1024 plates. Coordinate with Bolt Engine Phase 0 plan: `/workspace/arch-research-1008/PLAN-boltverse-engine.md` (World Graph zone.v1 + loader).

Order is mandatory. Finish (1) before (2). After each part: run its self-test, commit, then continue.

---

## (1) Gates as an API — shared failure JSON

Every object-gate check (and every check folded into `tools/gate/` if present) must emit / expose a **shared failure record** so fix loops and agents can act without parsing free text.

### Shape (stable; extend, do not rename)
```jsonc
{
  "check": "geometry.sealed",          // stable row id (prefer CHECK_IDS) or check string
  "status": "FAIL",                    // PASS | FAIL | INFO | WARN
  "failing_face_ids": ["face-12", "face-77"],  // empty array when N/A
  "world_position": [x, y, z],         // metres, world space; null when N/A
  "suggested_fix": "weld non-manifold edges at buried icicle roots; do not merge across separate columns"
}
```

### Requirements
- Extend `tools/object-gate/` report rows (and `fixPlan` items) so every FAIL carries the five fields above. Keep existing `id` / `detail` / `hints` for back-compat (minor API bump in API.md + API_VERSION).
- When a check already has face / box / morph data on disk (`geometry.json`, `boxes.json`, …), fill `failing_face_ids` and `world_position` from those; otherwise empty / null — never invent.
- `suggested_fix` is one short actionable sentence (from FIX_ACTIONS / hints); empty string only when status ≠ FAIL.
- CLI / `gateObject` / `gateScene` still exit as today; the JSON is additive.
- Document the shape in `tools/object-gate/API.md`.

### Self-test
`node tools/object-gate/selftest.mjs` (extend) exits 0 and proves:
| Sample | Expect |
|---|---|
| Existing ghost-v33 fixture (or synthetic sealed-mesh FAIL) | FAIL row has `failing_face_ids` (non-empty when fixture provides faces) + `world_position` + non-empty `suggested_fix` |
| Synthetic PASS row | status PASS; `failing_face_ids` []; `world_position` null; `suggested_fix` "" |
| Row missing the new fields (legacy fixture) | adapter fills defaults; self-test fails if a FAIL lacks `suggested_fix` |

Commit: `object-gate: shared failure JSON (check, status, faces, world pos, suggested_fix)`

---

## (2) Zone JSON as the single source of the scene

Loader must build the playable scene from **zone.v1 JSON only** — no parallel hard-coded object lists in the preview path for this step's acceptance.

### Scope
- Extend / harden `runtime/zone-loader.mjs` + `tools/world-graph/` so a zone file (`schema: "zone.v1"`) is enough to load objects, transforms, keyCamera, lighting, and library refs (`{ "library": "<id>" }` when library resolver exists; otherwise path-string assets as today).
- Refuse / warn on scene boot that injects objects not listed in the zone JSON (self-test covers this).
- Keep `schema/zone.v1.schema.json`. Do not break Zone B export round-trip (`tools/world-graph/selftest.mjs`).
- Align with Engine Core Phase 0: key-camera verify stays available; no Imagine calls.

### Self-test
`node tools/world-graph/selftest.mjs` exits 0 and proves:
| Case | Expect |
|---|---|
| Minimal fixture zone.v1 (tiny, committed ≤ 200 KB) loaded via zone-loader | objects present match zone.objects ids exactly |
| Zone with one extra hard-coded object injected outside JSON | FAIL / refused (loader or verify flags it) |
| Zone missing required keyCamera / schema | FAIL validation |
| Existing Zone B export round-trip | still green |

Write `steps/tools/02-gates-api/REPORT.md` with table (`part | check | PASS/FAIL | notes`) and paths to self-test output.

<!-- kit-gate: node tools/object-gate/selftest.mjs && node tools/world-graph/selftest.mjs -->
<!-- kit-gate-outdir: steps/tools/02-gates-api -->

Commit: `world-graph: zone.v1 is the single scene source`

---

## Done when
- (1) and (2) self-tests exit 0
- REPORT.md filled honestly
- `git diff --stat a0676f9f..HEAD` stays in tools/object-gate, tools/world-graph, runtime/, schema/, steps/tools/02-gates-api (and tiny fixtures)
- no Imagine tool call; no push/merge

END: branch, HEAD sha, REPORT path, self-test exit codes, anything Director must decide.
