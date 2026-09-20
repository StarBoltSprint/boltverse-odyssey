# 13d — Auto-scale Bolt to the plate road

HARD LOCK companion to `13-make-bolt-lane.md` + composite gate.  
**Grok must not choose Bolt size by eye.** A cook script sets scale from the road.

Tool: [`biome/scripts/bolt-scale/`](../scripts/bolt-scale/).

## Why

Sealed cycle REUSE still FAIL when the cutout is pasted at Imagine’s native size (lane-wide dog). Rules in chat get ignored. **Algo > hope.**

## Formula

\[
\mathrm{scale}_0 = \frac{k_{\mathrm{lane}}\,W_{\mathrm{lane}}}{W_{\mathrm{bolt}}}
\quad\text{then clamp withers}
\quad
\frac{H_{\mathrm{withers}}\cdot\mathrm{scale}}{H_{\mathrm{frame}}} \in [0.22,\,0.32]
\]

- \(k_{\mathrm{lane}} \approx 0.40\) (stance ≈ 35–45% of lane — not 70%+)  
- \(W_{\mathrm{lane}}\) from `path.json` `w(s)` at paw plant (or road mask width in px)  
- \(W_{\mathrm{bolt}}, H_{\mathrm{withers}}\) from keyed cycle alpha bbox  

Play:

\[
\mathrm{scale}(s)=\mathrm{scale}_0\cdot\mathrm{clamp}\!\left(\frac{w(s)}{w_{\mathrm{ref}}},\,0.85,\,1.15\right)
\]

## Order (PRIORITY 0)

1. Empty plate + `path.json`  
2. Key sealed `lock/bolt-gallop-cycle.mp4`  
3. Despill → **`computeScale` + `assertScale`** → plate grade → contact → grain  
4. Hang only if assert PASS  

**FAIL:** laneFrac > 0.55 or withers outside band. No KEEP.

## Not this

- Asking Imagine to “draw a smaller dog” (new sprint = banned)  
- One hardcoded px scale for every biome  
- Scaling the *plate* to fit Bolt  

Sealed 2026-09-20 — auto-scale cook gate.
