# Zone A step 2 — living sky

Verdict: PASS

Closed 360° night sky: 8 Imagine slices (1436×976, chain 11488×976) and a 1024×1024 zenith still, on a dome that follows the eye, plus three seamless Imagine video layers (stars 13.0 s, dust 16.708 s, nebula 28.95 s). Fog colour is `sampleHorizon` on the new slices (measured 0.255, 0.269, 0.375). Ground relief was left as it was.

Checked: `python3 tools/sky/check.py` PASS — swing 5.9935, close MAE 2.0475, join MAE 1.11–1.84, three loops PASS, combined repeat 62959 s, layer texBytes 4884480. Play mag_max 0.994, activeVideos 4, texMB 143.1, jsMs 2.9 after boot. Sky MAE 2.469 on the upper frame across 3.5 s. No console errors at 412×915 CSS DPR 2 and 360×800 CSS DPR 2. `tools/sky/selftest.py` exit 0, root `npm test` exit 0, `tools/playcheck` npm test 42 pass / 0 fail.

Known issues: the western eclipse glow is absent (it leaves the shared 6-luma band). Straight up still shows faint radial facets and one small pole notch after two projections. The video veils are 848×480 across the yaw, with weight eased off at the clip join. Manifest offsets are 1.7 s apart on one clock per layer. Heading 0 has a broad left/right brightness step (sky means 90 and 84) inside the swing limit.

Run (repo root, then stop the server):

```
python3 -m http.server 8899 --bind 127.0.0.1
```

Page: `http://127.0.0.1:8899/packs/zone-a/play/index.html?debug=1`

Screenshots (canvas 720×1600):

- `packs/zone-a/proof/step2/normal.png` — chase, spawn
- `packs/zone-a/proof/step2/normal-360.png` — same page at 360×800 CSS DPR 2
- `packs/zone-a/proof/step2/lookup.png` — straight up
- `packs/zone-a/proof/step2/crest.png` — highest interior crest (20, 33), height 5.40 m
- `packs/zone-a/proof/step2/rim.png` — high rim (32.5, 46.4)
- `packs/zone-a/proof/step2/join-000.png` — heading 0, wrap
- `packs/zone-a/proof/step2/join-045.png` — heading 45
- `packs/zone-a/proof/step2/join-180.png` — heading 180
- `packs/zone-a/proof/step2/motion-a.png` and `motion-b.png` — same view, 3.5 s apart
