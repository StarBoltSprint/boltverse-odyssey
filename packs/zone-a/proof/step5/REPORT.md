Built: kit-driven DetailGenerator beside the ground cards and the rock pebbles. Follow-up (code only, no Imagine call): cards seat on the drawn ground triangles, 170 mixed clumps, 1998 placed, 3996 drawn, one atlas 2048×1024 (unchanged), one instanced draw. Types shard 702, pebble 783, ridge 194, tuft 319 (variants 4 / 4 / 4 / 3). Near 2.8168/m², far 0.1585/m², clearing 567.
Checked: selftest PASS. Sky check PASS. Rocks selftest PASS. Root npm test exit 0. Playcheck 44/44 PASS. Gallop blocked 0, speed 4.4 (17.6 m / 120 ticks). drawCalls 10 → 11, texMB 236.4 → 247.0, download 40.319 → 41.564 MB (manifest 130 → 223 KB), detail load 140 ms after the first frame (swiftshader). Worst chase detail mag 0.78. Imagine calls 6/12, videos 0. GL errors 0.
Known issues: chase boom still reads as the plate carpet (more flecks, same read). Low-eye debug poses measure detail mag 1.27–2.49. Crossed tufts show a V at 45°. One pebble keeps a joined mirror. Two crystal crops are soft at the base. Two ridges are oblique. One tuft group lost its thin blades. No despill, so a thin key fringe can remain.

| row | measured | PASS/FAIL |
|---|---|---|
| 1 Details live | placed 1998 / drawn 3996 (shard 702, pebble 783, ridge 194, tuft 319; 170 clumps). Near 2.8168/m², far 0.1585/m², clearing 567. | PASS |
| 2 Eye-level read | Eye height: cards stand up, no grid in wide.jpg, world-locked. Seating on the drawn triangles: 0 of 1998 cards more than half buried, 0 floating (first pass: 66 of 700 more than half buried, 20 fully hidden). Chase boom: 2–3× more visible flecks, still the plate carpet. | FAIL |
| 3 Non-blocking | blocked 0. Speed 4.4 with details. | PASS |
| 4 Generic | `python3 tools/details/build.py --kit howling-eclipse` then `python3 tools/details/selftest.py` PASS. Recipe `docs/METHOD/details.md`. | PASS |
| 5 Magnification | texels/m shard 1801.2, pebble 1800.8, ridge 1800.4, tuft 1799.5. Mag 1 at about 1.0 m. Worst chase 0.78. Low-eye debug poses 1.27–2.49 (known issue; ground 2.3–3.0 there). | PASS |
| 6 Gates | root npm test 0. playcheck 44/44. sky check PASS. rocks selftest PASS. console/WebGL errors 0. Bolt sha matches the base file. Protected diffs empty. Imagine 6/12. | PASS |
| 7 Perf | drawCalls 10 → 11 (+1). texMB 236.4 → 247.0 (+10.6). Download 40.319 → 41.564 MB. Manifest 130 → 223 KB. | PASS |
| 8 Proof | shots below. Clip `gallop.mp4`. | PASS |

Shots: `before-chase.jpg` (details off), `chase.jpg` (same gallop pose, details on), `eye.jpg` (Bolt-height eye along the path), `close.jpg` (low eye 0.5 m along the path), `wide.jpg` (5.5 m up behind Bolt), `gallop.mp4`.

Run: `python3 tools/details/build.py --kit howling-eclipse` then `python3 tools/details/selftest.py`. Play: `packs/zone-a/play/index.html` (`?details=0` skips the layer).
