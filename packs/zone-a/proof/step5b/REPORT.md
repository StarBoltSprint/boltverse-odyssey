Built: v2 features beside the v1 micro cards. Four one-subject stills, one atlas 1937×1238 (12.197 MiB), one extra instanced draw, 72 single cards (cluster 18, slab 26, crest 12, pile 16). Micro cards unchanged (1998 placed, 3996 drawn).
Checked: selftest PASS. Gallop blocked 0, speed 4.4. Worst chase detail mag 0.777 over 120 ticks. Low eye 2.52. drawCalls 11 → 12, texMB 247.0 → 259.2, download 41.56 → 44.01 MB. Imagine calls 7/8, videos 0.
Known issues: chase near plates still read as a carpet; sky line does gain silhouettes. Low eye mag 2.52. One cluster variant shared by 18 cards. Crest texels/m 428. v1 card defects unchanged. Thin key rim can remain.

| row | measured | PASS/FAIL |
|---|---|---|
| 1 Chase read | Same pose as v1 (spawn (−6, −14), heading 32°, 75 ticks of 1/30 s, still galloping, boom 7.2 m). before-chase.jpg has a clean sky line. chase.jpg adds silhouettes on that line and a few mid-ground rocks. The near ground still reads as the plate carpet with flecks. | FAIL |
| 2 Grounding and placement | 72 features seated with the drawn-mesh seater, bury 0.05 m. Counts placed/drawn: cluster 18/18, slab 26/26, crest 12/12, pile 16/16. Inner edge stays past 0.95 m. No lattice in wide.jpg. Shots do not show a floating card. | PASS |
| 3 Non-blocking | blocked 0 over 120 ticks. Speed 4.4. | PASS |
| 4 Magnification | texels/m cluster 911.0, slab 1231.9, crest 428.1, pile 996.1. Micro still ~1800. Worst chase mag 0.777. Low close-up mag 2.52 (known issue). | PASS |
| 5 Perf | drawCalls 11 → 12. texMB 247.0 → 259.2. Download 41.56 → 44.01 MB (features.png 2.431 MB + features.json 11 KB). | PASS |
| 6 Gates | root `npm test` exit 0. playcheck `npm test` 44 pass, exit 0. `python3 tools/details/selftest.py` PASS. `python3 tools/sky/check.py` PASS. `python3 tools/rocks/selftest.py` PASS. Proof-shot console errors none. Bolt sha matches the base file. Protected diffs empty. Tracked diff has no paint words or cook text. Imagine calls with `"pass": "v2"` = 7. Videos 0. | PASS |
| 7 Proof | before-chase.jpg, chase.jpg, eye.jpg, wide.jpg, close.jpg. | PASS |

Shots: `before-chase.jpg` (details off, same gallop pose), `chase.jpg` (details and features on), `eye.jpg` (eye about 0.85 m along the path), `wide.jpg` (5.5 m up behind Bolt), `close.jpg` (low eye, mag 2.52).

Run: `python3 tools/details/build.py --kit howling-eclipse` then `python3 tools/details/selftest.py`. Play: `packs/zone-a/play/index.html` (`?details=0` skips the layer).
