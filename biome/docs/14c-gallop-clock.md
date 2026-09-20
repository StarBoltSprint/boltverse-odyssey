# 14c — Gallop clock (anti-saccadé)

HARD LOCK. Companion to sealed `lock/bolt-gallop-cycle.mp4` + `13d-auto-scale.md`.

**Symptom:** road smooth, Bolt stop-motion / skating.  
**Cause:** compositor steps the cycle (1-of-N) or ignores `plate_time`; cadence ≠ road rush.

## PRIORITY 0 — after REUSE + scale

1. Key sealed cycle (96 fps KEEP).  
2. `bolt-scale` assert.  
3. **`gallop-clock`**: phase from `plate_time`, native fps, `strideHz≈4`.  
4. Road `ds` from `dsPerFrame(strideLength, plateFps)`.  
5. Light + contact.  

Tool: [`biome/scripts/gallop-clock/`](../scripts/gallop-clock/).

## Laws

- `phase = (plateTime * strideHz / stridesPerCycle) % 1`  
- Frame = `floor(phase * cycleFrames)` — continuous, no hold frames on purpose  
- Ban: independent `requestAnimationFrame` gallop, `playbackRate` that drops frames, drawing every 4th plate frame  
- Smoke FAIL: dog effective fps < ~85% of `min(96, plateFps)`, or skate  

## Not this

- Recooking a “smoother” dog (REUSE only)  
- RIFE on the composite to hide stepping  
- Speeding the sprite sheet past plate time  

Sealed 2026-09-20 — gallop clock anti-saccadé.
