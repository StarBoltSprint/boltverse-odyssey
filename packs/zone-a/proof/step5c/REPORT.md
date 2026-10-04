Built (code only, 0 Imagine calls, no new texture): near band of the existing v2 one-still features, 1.5–4 m off the running line in noise-driven clumps (93 added, 165 total), each card as tall as its own pixels allow from the closest chase eye that can see it; painted dust collar sunk under the drawn ground; U-mirroring only without a nearby same-type twin; frustum-aware detail magnification; atlas upload flip fixed (the cards had been sampling a vertically mirrored atlas band); debug HUD hidden for players (`?hud=1` shows it).
Checked: root npm test 0, playcheck 44/44, details selftest PASS (near 104 with test variants), sky check PASS, rocks selftest PASS, Bolt sha matches, protected paths no diff vs ffeb84b. drawCalls 12, texMB 259.2, download 42.21 MB, details load 258 ms after first frame (swiftshader). Chase worst feature mag 0.644 (120 ticks) / 0.796 (420 ticks). Gallop blocked 0, speed 4.4. Console/GL errors 0.
Known issues: the now-visible micro cards read as a dense high-contrast peg field (thin them? owner call); the near band still shows two loose lines in the wide view; the chase frame bottom (4–8 m) only spans about ±1.2 m around the running line, so it still shows plates; features have no collider (off-line steering passes through, the camera can enter a card: weave run mag 12.8).

| row | measured | PASS/FAIL |
|---|---|---|
| Chase read | Flanking rock masses and the skyline now cut the sky; the ground is populated with standing objects. Not the flat carpet. New issue: busy micro scatter. | PASS (with issue) |
| No stretch | chase 0.644 / 0.796 (frustum metric); weave off-line 12.8 | PASS on the line, FAIL off it |
| Caps | drawCalls 12 ≤ 12, texMB 259.2 ≤ 260 | PASS |
| Gates | npm, playcheck, selftests, sky, Bolt sha, protected | PASS |

Shots: `chase-before-after.jpg` (v2 d6c1561 left, v3 right, same pose), `chase-gallop.jpg`, `eye-level.jpg`, `wide.jpg`.
Run: `python3 tools/details/build.py --kit howling-eclipse` then `python3 tools/details/selftest.py`.
