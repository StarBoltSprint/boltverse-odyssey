# learn/proposals

Candidate recipe overlays. Each file is one variant of a `docs/METHOD/<id>.md` recipe. `tools/recipe-improve` reads the recipe and applies the overlay in memory, on the same plates, kit, and scene.

An input file stays `proven: false`. A strict win writes `<id>.proven.json` beside it. That file is for Director. The tool does not edit `docs/METHOD`.

```json
{
  "schema": "recipe-proposal/1",
  "recipe": "ground",
  "id": "ground-relief-pass",
  "kind": "param",
  "summary": "One sentence.",
  "proven": false,
  "params": { "reliefMinM": 0.3 },
  "objectGate": "path/to/report.json",
  "shotSheet": "path/to/shot-verdict.json",
  "perfReport": "path/to/__perfReport.json"
}
```

`kind` is `param` (a shallow param overlay) or `patch` (a unified diff applied to a copy of the recipe text). Omit `objectGate`, `shotSheet`, or `perfReport` to reuse the baseline measurement. Set a key to `null` when that arm has no shot sheet or no `__perfReport`.

The three `ground-*` files here are the self-test fixtures. They are not owner-approved recipe changes.

Score and the blocking rule: [`tools/recipe-improve/README.md`](../../tools/recipe-improve/README.md).
