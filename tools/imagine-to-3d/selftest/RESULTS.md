# Self-test results: 2026-10-09 on the box, Zone B assets

Full log: `selftest-2026-10-09.log`. The scripts point at absolute box paths for the Zone B key, crops, plates and views
(/workspace/zb-bible-1008, /workspace/zb-preview-1008). They read those files only.

| Module | Test | Result |
|---|---|---|
| classify | 16 tuning crops (mesas, 6 towers, wreck, panel, rail, tablet, veils, grains) | 15/16. `rock-mesaR-arch` comes out as building because that crop holds the right-hand tower. |
| classify | 7 held-out crops of the key (3 towers, 2 mesas, debris, truss) | **7/7** |
| classify | creature / vegetation / ice | Zone B has no samples of these, so they always go to Grok vision (`needsVision`). |
| coarse + views | mesaA real Imagine views | front IoU 0.933 vs key. Side and top accepted as axis-defining, then the scaffold is refit. **Back 0.758 → regenerate**: the current back plate really drifted. A tower side passed off as the mesa scored 0.09 and was rejected. |
| coarse + views | m2 tower | front 0.9995. Side and top accepted, refit. q45 **0.886** vs the refit scaffold, PASS. |
| coarse + views | m4 negative | "side" that is a copy of the front (IoU 0.979) **rejected** |
| views plan | section plates at max(128, phone) px/m near ground (135–180), 64 above | mesaA 20,128 m² → 481 plates. m2 8,284 m² → 229. m4 7,815 m² → 187. |
| pbr | w1 + real Imagine albedo/height plates; fallbacks on w1 and m2 | Map byte-identical. All maps native size, unit normals, no violet, relight response OK. **Albedo delit FAIL in all 3** (0.301 with the Imagine albedo plate): Imagine's "albedo" still carries shading, so fixloop sends regen_albedo. Threshold still to calibrate on more plates. |
| compare | identity / violet shift / old in-game dome mesa / wrong object | PASS (checklist 100 % with a vision record) / FAIL (histogram 0.805, shadow) / FAIL (LPIPS 0.526, SSIM 0.348, IoU 0.713, checklist 0) / FAIL on all rows except shadow (no cast shadow found) |
| fixloop | coverage + loops | All 18 gate FIX_ACTIONS mapped. Real gate fixPlan mapped. Sharpness loop passes at iteration 2. Persistent silhouette failure: regen_view → refine_depth → regen_view → **HARD FAIL**. Vision-only failures → NEEDS_REVIEW. |
| keyvideo | stub + real 10 s Imagine key video | Stub batch OK. Video analysed: 20 frames, one gust (period estimate unreliable on a single 10 s clip), flow 22°, 12 candidate items (mostly transient sand). **Guard: coarse refuses a video frame.** |

Imagine end-to-end: one Grok Build step made 3 Imagine calls (key video 1280×720 10 s, w1 albedo and height
1280×720). All were ingested with sha256 and native-size provenance.
