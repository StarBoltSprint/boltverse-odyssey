# recipe-improve ground vs ground-relief-pass

Decision: adopt_variant
Because: strictly_better
Score current: 28/32
Score variant: 30/32
Blocking regressions: 0

## Inputs

Recipe file: docs/METHOD/ground.md
Recipe sha256: cf934379179faeba63b18b7d89185e380d4d22146a694b819f3005915f5e5229
Plates: tools/recipe-improve/fixtures/plates/ground-a.json, tools/recipe-improve/fixtures/plates/ground-b.json
Kit: biome/kits/howling-eclipse.json
Scene: tools/recipe-improve/fixtures/scene.json
Same inputs: true
Perf: current perfRows, variant perfRows

## Params

Kind: param
Baseline: {}
Variant: {"reliefMinM":0.3}

## Per-check diff

| Check | Current | Variant | Delta |
| --- | --- | --- | --- |
| object/ground/geometry.relief | FAIL | PASS | improved |
| object/ground/grounding | PASS | PASS | same |
| object/ground/texel.stretch | FAIL | FAIL | same |
| perf/perf.adaptive | PASS | PASS | same |
| perf/perf.canvas-ratio | PASS | PASS | same |
| perf/perf.default-ratio | PASS | PASS | same |
| perf/perf.ground-order | PASS | PASS | same |
| perf/perf.quality-kept | PASS | PASS | same |
| perf/perf.sky-order | PASS | PASS | same |
| runtime/runtime.shader | PASS | PASS | same |
| shot/3 m up | KEEP | KEEP | same |
| shot/45° | KEEP | KEEP | same |
| shot/8 m | KEEP | KEEP | same |
| shot/grazing | KEEP | KEEP | same |
| shot/key | KEEP | KEEP | same |
| shot/verdict | KEEP | KEEP | same |

## Proven

A proven patch was emitted for Director. docs/METHOD was not edited.
