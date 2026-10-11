# World graph 1011

Zone file on the existing Zone B preview. No new renderer. The live preview was not edited.

| # | Done when | Result |
| --- | --- | --- |
| 1 | `zone.v1` schema, and `zone-b.zone.json` validates | PASS. `node tools/world-graph/selftest.mjs` accepts the file. 36 objects, 12 todo rows. |
| 2 | Export invents nothing; payloads round-trip | PASS. `runtime.biome`, `runtime.layout`, and `runtime.groundDetail` deep-equal the three preview files. `gameplay.lanes` is null. Hero pose is the `objects-t7.mjs` spawn (`x=-51.115`, `z=9.63`, `yaw=75`, `pitch=-1.16`, `eye=3.15`). Street xz is `avenue2At` (`x=-7.4485346997279205`, `z=3.4352741381180083`). |
| 3 | Loader builds from the zone file | PASS. `feedForUrl` answers `biome.json`, `objects1/layout.json`, and `gdet/ground-detail.json`. Other URLs are left to the preview. |
| 4 | Pixel mean ≤ 1/255 on hero, street, and 8 m | PASS. Mean absolute channel difference is 0 on all three. Reference luma 0.368, 0.431, 0.323. Hero and street frames differ. |
| 5 | Verify JSON has SSIM, LPIPS, draw calls, triangles | PASS. `steps/world-graph-1011/verify-report.json`. Key view 1280×720 against `key-city3.jpg`: SSIM 0.520, LPIPS 0.601, draw calls 25, triangles 734347. |
| 6 | `docs/METHOD/world-graph.md` | PASS. Written. |
| 7 | Selftest exit 0 | PASS. `node tools/world-graph/selftest.mjs`. |
| 8 | Live preview untouched | PASS. `index.html` and `main.mjs` size and mtime matched before and after verify. |

## Quality gates already in the preview

`biome.budgets` is draw calls 12 and 150000 triangles. The key-camera measure of the current preview is 25 draw calls and 734347 triangles. Both the reference page and the zone page report the same counts. No LPIPS threshold is stored, so none was added. This step does not retune the preview.

## Phone preview

`tools/preview/freeze.py` needs a play directory. This step has none. Freeze was not run. Nothing was published.

Verdict: PASS
