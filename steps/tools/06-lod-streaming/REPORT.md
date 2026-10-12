# tools/06-lod-streaming

Verdict: PASS

Package: `tools/lodstream`. Object-gate stays the live-scene gate. It compares rendered depth passes and allows a small XOR fraction. This step needs an offline check on lod0, lod1, and lod2 meshes before a scene exists, so the helper is a new package. The silhouette row reuses the outline half of `tools/object-gate/py/lod_gate.py` (XOR of the two hit masks). The limit here is 0 px. Mask 540×960, vertical field 58°, yaws 0/90/180/270. Distance is eye to the union bounding-box centre.

Decree brief: `steps/tools/06-lod-streaming/decree-brief.md`. No local decrees file. Nothing was invented.

No Imagine calls. No push. No merge.

## Measured rows

| # | Done when | Result |
| --- | --- | --- |
| 1 | Outline difference at the 15 m and 40 m switches is 0 px, or the gate fails. | `fixtures/good`: diffPx 0 at 15 m (hitPx 61504) and 0 at 40 m (hitPx 7744). `fixtures/outline-diff`: exit 1, 15 m diffPx 46128, 40 m diffPx 0. |
| 2 | Triangle counts are recorded. lod0 over the profile budget fails. Default budget is 80000. | Good counts 13 / 12 / 12, limit 80000, pass. `fixtures/over-budget`: lod0 80001, exit 1, silhouette still 0 px. Inline profile `lod0Max` 10 fails the 13-triangle mesh. |
| 3 | A coarser LOD with more triangles than the finer LOD fails. | In-process `coarser-heavier`: lod2 24 > lod1 12, `lod-monotone` fail. |
| 4 | Texture checklist: Imagine plate, both sides ≥ 1024, mipmaps present. | `fixtures/missing-mipmaps`: exit 1, `texture-mipmaps` fail, native row still pass. In-process 512×512: `texture-native` fail. Good 1024×1024 with mipmaps passes. |
| 5 | JSON report for playcheck and library intake. | `lodstream-report/1` written by `--out`. Blocks `playcheck` and `library`. The command does not register an object and does not start playcheck. |
| 6 | Self-test exits 0 and the bad fixtures fail. | `node tools/lodstream/selftest.mjs` exit 0. Bad CLI exits were 1. Usage with no args exits 2. |
| 7 | No Imagine, no push, no merge. | No image or video generation. Worktree was not pushed or merged. |

## Command

```bash
node tools/lodstream/selftest.mjs
node tools/lodstream/gate.mjs --manifest tools/lodstream/fixtures/good/manifest.json --out /tmp/lodstream-good.json
```

Kit gate comment in the spec is `node tools/lodstream/selftest.mjs`.

## Limits

The checklist trusts the declared plate size, `source: "imagine"`, and `mipmaps`. It does not open a PNG. `padTriangles` adds degenerate triangles to the count and does not draw them. Interior depth pop is outside this gate. Phone preview was not frozen: this step has no play tree.
