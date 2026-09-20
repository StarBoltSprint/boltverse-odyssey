# 13d — Auto-scale Bolt to the plate road

HARD LOCK companion to `13-make-bolt-lane.md` + composite gate.  
**Grok must not choose Bolt size by eye.** A cook script sets scale from the road.

Tool: [`biome/scripts/bolt-scale/`](../scripts/bolt-scale/).  
After REUSE cycle + `bolt-scale`, MUST sync gallop via [`gallop-clock`](../scripts/gallop-clock/) ([14c](14c-gallop-clock.md)): native 96 fps (no 1-of-N), phase from `plate_time`, `strideHz≈4`, road `ds` from `dsPerFrame`. `assertGallopClock` **FAIL** if dogFps ≪ plateFps.

## Why

Sealed cycle REUSE still FAIL when the cutout is pasted at Imagine’s native size (lane-wide dog). Rules in chat get ignored. **Algo > hope.**

## Priority

1. **HARD — anti-truck** `laneFrac ∈ [0.30, 0.55]` (k ≈ 0.40 preferred). Dog ≈ truck = **FAIL**.  
2. **withers** target ~0.27 of frame, band 0.22–0.32.  
3. **`withersMin` is soft** — do not grow Bolt into the lane just to hit 0.22. Pass `hardWithersMin` only when SmiR wants that fight (then assert may FAIL if lane cannot hold it).  
4. Measure `boltWithersPx` at the **shoulders**, not ear tips (ear bbox inflates height → wrong scale).

## Wide road (law 20 default — any biome)

Default empty stills start from the **full** [20-default-plate-proportions.md](20-default-plate-proportions.md) set: 3-lane **~0.75–0.82**, sky **~45%**, plant **~0.80**, withersFrac **~0.10 KEEP**. Frost aurora KEEP is the worked example ([20b](20b-frost-aurora-proportions.md)).

On that wide chase road, PATH is often still Beat-calibrated (~0.65). `laneFracMax=0.55` vs PATH already yields `withersFrac ~0.10`. That is **KEEP**: a dog on a highway, not a sticker filling the lane.

**FAIL:** widen PATH to the visual neon then re-run 13d (Bolt +22 % → truck). **FAIL:** grow Bolt to hit 0.22 withers on a wide plate. `withersMin` stays soft.

If you retune the ribbon so dodge sits on the visual lanes, **cap scale at the old PATH lane** — lanes move, dog size does not.

## Formula

Prefer withers target, then HARD-clamp stance to the lane band:

\[
\mathrm{scale}_{0}=\frac{H_{\mathrm{target}}\,H_{\mathrm{frame}}}{H_{\mathrm{shoulders}}}
\quad\text{then}
\quad
\mathrm{laneFrac}=\frac{W_{\mathrm{bolt}}\,\mathrm{scale}}{W_{\mathrm{lane}}}\in[0.30,\,0.55]
\]

- \(k_{\mathrm{lane}} \approx 0.40\) (stance ≈ 35–45% of lane — not 70%+)  
- \(W_{\mathrm{lane}}\) from `path.json` `w(s)` at paw plant (or road mask width in px)  
- \(W_{\mathrm{bolt}}\) from keyed cycle alpha bbox (stance)  
- \(H_{\mathrm{shoulders}}\) = withers at **shoulders**, not ears  

Play:

\[
\mathrm{scale}(s)=\mathrm{scale}_0\cdot\mathrm{clamp}\!\left(\frac{w(s)}{w_{\mathrm{ref}}},\,0.85,\,1.15\right)
\]

## Order (PRIORITY 0)

1. Empty plate + `path.json`  
2. Key sealed `lock/bolt-gallop-cycle.mp4`  
3. Despill → **`computeScale` + `assertScale`** → **`gallop-clock` / `assertGallopClock`** ([14c](14c-gallop-clock.md)) → plate grade → contact → grain  
4. Hang only if assert PASS  

**FAIL:** `laneFrac > 0.55` (dog≈truck) or `laneFrac < 0.30`. withersMin alone is not KEEP-block unless `hardWithersMin`. No KEEP on truck.

## Not this

- Asking Imagine to “draw a smaller dog” (new sprint = banned)  
- One hardcoded px scale for every biome  
- Scaling the *plate* to fit Bolt  
- Measuring withers to the ear tips  
- Growing the dog past the lane to hit withersMin  

Sealed 2026-09-20 — auto-scale cook gate (anti-truck HARD).
