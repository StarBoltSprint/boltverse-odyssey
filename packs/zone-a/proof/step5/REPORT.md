Built: kit-driven DetailGenerator beside the ground cards and the rock pebbles. 700 placed, 1400 drawn, one atlas 2048×1024, one instanced draw. Types shard 260, pebble 220, ridge 100, tuft 120 (variants 4 / 4 / 4 / 3). Near 1.0547/m², far 0.0703/m², clearing 214.
Checked: selftest PASS. Sky check PASS (13 slices, 0 failures). Rocks selftest PASS. Root npm test exit 0. Playcheck details test PASS. Gallop blocked 0, speed 4.4 both ways (17.600 m / 120 ticks without details, 22.000 m / 150 ticks with details). drawCalls 10 → 11, texMB 236.4 → 247.0, download 40.318 → 41.469 MB, detail load 60 ms after the first frame. Chase detail mag 0.642, aimed close 0.999, low eye 1.392. Imagine calls 6/12, videos 0. GL errors 0.
Known issues: chase boom still reads as the plate carpet (flecks only). Low eye inside the scatter measures detail mag 1.392. One pebble keeps a joined mirror and sits proud. Two crystal crops are soft at the base. Two ridges are oblique. One tuft group lost its thin blades. No despill, so a thin key fringe can remain.

| row | measured | PASS/FAIL |
|---|---|---|
| 1 Details live | placed 700 / drawn 1400 (shard 260, pebble 220, ridge 100, tuft 120). Near 1.0547/m², far 0.0703/m², clearing 214. Visible in chase.jpg and eye.jpg. | PASS |
| 2 Eye-level read | Eye height: cards stand up, ridge line breaks the silhouette, no grid in wide.jpg, world-locked. Chase boom: flecks on the same plate carpet. One mirrored pebble sits proud. | FAIL |
| 3 Non-blocking | blocked 0. Speed 4.4 with and without details. Distance matches 4.4 × ticks / 30. | PASS |
| 4 Generic | `python3 tools/details/build.py --kit howling-eclipse` then `python3 tools/details/selftest.py` PASS. Recipe `docs/METHOD/details.md`. | PASS |
| 5 Magnification | texels/m shard 1801.2, pebble 1800.1, ridge 1820.8, tuft 1800.9. Mag 1 at 0.995 / 0.996 / 0.985 / 0.996 m. Worst chase 0.642. Aimed close 0.999. Low eye 1.392 (known issue). | PASS |
| 6 Gates | root npm test 0. playcheck details test PASS. sky check PASS. rocks selftest PASS. console/WebGL errors 0. Bolt sha matches the base file. Protected diffs empty. Imagine 6/12. | PASS |
| 7 Perf | drawCalls 10 → 11 (+1). texMB 236.4 → 247.0 (+10.6). download MB 40.318 → 41.469 (+1.151). detail load 60 ms after first frame. | PASS |
| 8 Proof | shots below. Clip `gallop.mp4` 6.0 s, 720×1600, 1.05 MB. | PASS |

Shots: `before-chase.jpg` (details off), `chase.jpg` (same pose, details on), `eye.jpg` (low eye), `close.jpg` (aimed along the path), `wide.jpg`, `gallop.mp4`.

Run: `python3 tools/details/build.py --kit howling-eclipse` then `python3 tools/details/selftest.py`. Play: `packs/zone-a/play/index.html` (`?details=0` skips the layer).
