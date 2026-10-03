# Zone A step 2b — living sky

Built: eight chained Imagine horizon slices (1867×864, eclipse in slice 6), eight upper (1424×1248), eight high (1152×864), a 1024 cap from 76°, and the existing stars/dust/nebula loops as instanced 21.18°×11.25° tiles at low additive gain. Ground, lock, and Bolt were not recooked.

Checked: `python3 tools/sky/check.py` PASS — horizon mag 0.982, upper 0.933, high 0.982, cap 0.901, stars/dust/nebula 0.792, failures 0. Play at 720×1600: mag_max 0.982, activeVideos 4, drawCalls 7, texMB 219.9, console errors 0. Loop-restart sky MAE about 1.0 (stars 1.00, dust 0.97, nebula 0.94). `python3 tools/sky/selftest.py` PASS (old 848×480-over-360° layout mag 13.465 FAIL; tiled layout PASS). Root `npm test` PASS (STILL-REASONS, IMAGINE-HOOKS, COLD-START, KITCHEN-FAIL). `tools/playcheck` `npm test`: 43 pass, 0 fail, including the stretched-sky-video mag_max FAIL and the tiled mag_max PASS.

Known issues: heading 0 still shows two cloud banks meeting (no hard pixel cliff; column diff at centre is under the median). Straight up, the cap's dark centre and the lat-long joins read as a disk and spokes. Upper slice 3 (heading 135–180) has a mirrored dust column. High-band slice medians swing by 26, which the horizon-slice gate does not score. Total texMB is about 220 (was about 143) because three bands stay resident.

Run (repo root, then stop the server):

```
python3 -m http.server 8899 --bind 127.0.0.1
```

Page: `http://127.0.0.1:8899/packs/zone-a/play/index.html`

Screenshots (canvas 720×1600, phone viewport 412×915 CSS DPR 2):

- `packs/zone-a/proof/step2/hdg-0.jpg` — heading 0
- `packs/zone-a/proof/step2/hdg-90.jpg` — heading 90
- `packs/zone-a/proof/step2/hdg-180.jpg` — heading 180
- `packs/zone-a/proof/step2/hdg-285.jpg` — eclipse azimuth
- `packs/zone-a/proof/step2/up-45-285.jpg` — look up 45° at 285°
- `packs/zone-a/proof/step2/zenith.jpg` — straight up
- `packs/zone-a/proof/step2/crest-285.jpg` — highest crest, heading 285
- `packs/zone-a/proof/step2/ring-contact.jpg` — slice contact sheet

Loop-restart frames stay untracked in `/workspace/grokcli/out/zoneA-step2b/qc/`.
