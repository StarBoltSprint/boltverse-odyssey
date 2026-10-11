# tools/world-graph

One zone = one JSON file (`zone.v1`). Method: [`docs/METHOD/world-graph.md`](../../docs/METHOD/world-graph.md). Schema: [`schema/zone.v1.schema.json`](../../schema/zone.v1.schema.json). Loader: [`runtime/zone-loader.mjs`](../../runtime/zone-loader.mjs).

## Steps

1. `node tools/world-graph/export-zone-b.mjs` — writes `zone-b.zone.json` from the current Zone B preview. Copies stored numbers only; anything the preview does not store goes in `todo`.
   `node tools/world-graph/export-zone-c.mjs` — writes `steps/zone-c/03-terrain/zone-c.zone.json` from the causeway step. Same rule: stored numbers only.
2. `node tools/world-graph/selftest.mjs` — schema name, export round-trip, the three runtime payloads (`biome.json`, `layout.json`, `ground-detail.json`), placeholder wake, live preview untouched.
3. `node tools/world-graph/serve.mjs` — local compare server: `/ref` is the live preview, `/zone` the same files booted from the zone file (frozen clock). Prints the port.
4. `python3 tools/world-graph/capture.py --port N --out report.json` — headless shots from the hero, street and 8 m poses on both pages; pixel rule: mean abs channel difference ≤ 1/255.
5. `node tools/world-graph/verify.mjs` — runs the compare end to end, renders `keyCamera` at the key size, writes SSIM, LPIPS (Alex), draw calls and triangles to `steps/world-graph-1011/verify-report.json`.

## Known gap

The Zone B scene is over the bible budget (about 734 000 triangles on screen vs `trisOnScreen` 150 000). This step measures it and does not retune the preview; it is scheduled for the speed phase.

No models are used. No Imagine images.
