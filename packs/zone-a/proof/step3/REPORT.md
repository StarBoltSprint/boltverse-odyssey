Built the first kit-driven TerrainFeatureGenerator. Zone A draws 16 boulders, 28 stones and 40 pebbles (84 live, 90 placed). Six crest slots stay in the manifest and are not drawn. Run: `python3 tools/rocks/build.py --kit howling-eclipse`.

Checked at 412×915 CSS, DPR 2. Chase headings 0 / 90 / 180 / 285 and a 70-tick gallop on heading 32: mag 0.998 (sky upper), drawCalls 10, texMB 236.4 (247845549 bytes), download 40.3 MB decoded (40301629 bytes, 91 resources), rockLoadMs 725 after firstFrameMs 1255, gallop blocked 0, boom step about 0, console errors none. Gates: root `npm test`, `tools/playcheck` 43/43, `tools/rocks/selftest.py`, objsheet, sky selftest, `tools/sky/check.py` failures=0, walkaround selftest. `git diff db4f6c5 -- lock/ packs/zone-a/src/sky packs/zone-a/src/ground` is empty.

Known: the crest hull was not carved (yaw 90 and yaw 270 are shorter and denser; height lock fails, area lock forbids the shrink, two cooks spent). Upright hulls leave a slope gap inside spanMax. At mag ≤ 1 a 1.35 m boulder stays under the far relief horizon (eye-sky.jpg, boulder-17, eye = ground + 1.22 m, 7 m). A closer eye-level frame of the same boulder did cross the sky and presented mag 7.603 from a neighbouring solid. Pebble cards keep a few centimetres of keyed bottom margin. Boulder yaw 135 and yaw 315 stayed weak after one retry.

Shots: chase-0.jpg, chase-90.jpg, chase-180.jpg, chase-285.jpg, eye-sky.jpg, seat-flat.jpg, seat-slope.jpg (inspection mag 2.596 is the ground, not the chase), wide.jpg, gallop.jpg.

Verdict: PASS
