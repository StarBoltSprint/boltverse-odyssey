Built: `packs/zone-b/` Ember Mesa ground (7800 m², 3 Imagine families, image-depth maps, no cutouts) and a 10×36° horizon band plus one living loop, with zone A upper/high/cap reused unstretched. IN TEST. Not a lock.
Checked: relief span 2.001 m / 20 m, slope 14.50°, over-15° cells 0; worst mag 0.998 (upper) over a 120-tick gallop and headings 0/90/180/270; drawCalls 5, texMB 178.5, download 28.7 MiB, activeVideos 2; sky gate 7 failures; same-view sky MAE 4.00 in 1.2 s (`dust.mp4` 3.30 s → 4.97 s); root `npm test` 0, playcheck 43/43, sky selftest PASS, kit check PASS; Bolt sha matches the base file; `git diff origin/main -- lock/ packs/zone-a/src` empty. Imagine calls 16/16.
Known issues: sky motif on slices 2, 4, 5, 6; exposure swing 62; chase still shows slice steps and the reused upper band above 19.15°; ground reads as one tile period up close and in the wide shot; dust tiles still stamp frame structure; no standing cards; horizon row is not level across slices.

| row | measured | PASS/FAIL |
|---|---|---|
| Look | Chase shows the kit azimuth, far silhouettes, and a repeated ground period. Slice steps and the reused upper band stay visible. Shots below. | FAIL |
| Ground | 3 families, h0–h7 depth maps, span 2.001 m, slope 14.50°, 0 cells over 15°. Wide shot still one period. | FAIL |
| Sky | `check.py` failures 7 (motif + exposure 62). Joins 0. Closed dome. One instanced dust draw. Sky MAE 4.00 over 1.2 s. | FAIL |
| Magnification | worst 0.998. ground ≤ 0.910, horizon 0.992, upper 0.998, high 0.982, cap 0.989, dust/stars/nebula tile 0.792 | PASS |
| Perf | drawCalls 5, texMB 178.5, download 30078868 bytes, activeVideos 2. Zone A sources unchanged (diff empty). | PASS |
| Gates | npm test 0; playcheck 43 pass; sky selftest PASS; kit check PASS; console empty on the reshoot; Bolt sha match; Imagine 16; HUD off without `?debug=1` | PASS |
| Docs | ground Part 2b, sky Part 3, self-improvement §6, decisions-log 2026-10-04, METHOD zones row. All IN TEST. | PASS |
| Proof | JPEGs in this folder, each under 110 KB | PASS |

Shots (720×1600 JPEG):

- `chase-gallop.jpg` — spawn gallop, heading 255
- `ground-close.jpg` — eye 0.55 m, 2.2 m behind Bolt
- `sky-h000.jpg` `sky-h090.jpg` `sky-h180.jpg` `sky-h270.jpg` — spawn, those headings
- `wide.jpg` — `lookAt([-40,18,-24],[6,1,14])`

Run: `http://127.0.0.1:8981/packs/zone-b/play/index.html` (this worktree, `python3 -m http.server 8981 --bind 127.0.0.1`). Proof driver was a headless Chrome `toDataURL` pass with `?debug=1` (HUD hidden before each shot). Sky gate: `python3 tools/sky/check.py --manifest packs/zone-b/src/sky/sky.json --out /workspace/grokcli/out/zoneB/step1/run/sky-check`.
