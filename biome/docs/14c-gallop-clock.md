# 14c — Gallop clock (anti-saccadé)

HARD LOCK. Companion to sealed `lock/bolt-gallop-cycle.mp4` + `13d-auto-scale.md` + [15-gpu-compositor.md](15-gpu-compositor.md).

**Symptom:** road smooth, Bolt stop-motion / skating.  
**Cause:** compositor steps the cycle (1-of-N), seeks every rAF, harvests 534 canvases, or ignores `plate_time`; cadence ≠ road rush.

## Canon cycle (6 s)

- File: [`lock/bolt-gallop-cycle.mp4`](../../lock/bolt-gallop-cycle.mp4) (= `bolt-gallop-cycle-96fps-loop6s`)
- Spec: **~5.56 s · 96 fps · 768×1168 · 534 frames**
- Constants: `CYCLE_FPS=96`, `CYCLE_FRAMES=534`, `STRIDES_PER_CYCLE=22`
- Play: `bolt.loop = true`, rate **1×**. Never seek every frame. Never cache 534 canvases.
- Archive: `lock/bolt-gallop-cycle-0.93s-prev.mp4` (old 89-frame) — **FAIL if used as play cycle**.

## PRIORITY 0 — after REUSE + scale

1. Key sealed **6 s / 534-frame** cycle (96 fps KEEP).  
2. `bolt-scale` assert.  
3. **`gallop-clock`**: phase from `plate_time`, native fps, `strideHz≈4`.  
4. Road `ds` from `dsPerFrame(strideLength, plateFps)`.  
5. Light + contact. GPU compositor: [15](15-gpu-compositor.md) + hung [`bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts). Ban CPU `getImageData` hot path.  

Tool: [`biome/scripts/gallop-clock/`](../scripts/gallop-clock/).

## Laws

- `phase = (plateTime * strideHz / stridesPerCycle) % 1`  
- Frame = `floor(phase * cycleFrames)` — continuous, no hold frames on purpose  
- Play the `<video>` at **1× loop** (decoder owns 96 fps). Do **not** `currentTime` every rAF.  
- Ban: independent `requestAnimationFrame` gallop, `playbackRate` that drops frames, drawing every 4th plate frame, harvesting all 534 frames into canvases, playing the archived 0.93 s / 89-frame lock  
- Smoke FAIL: dog effective fps < ~85% of `min(96, plateFps)`, or skate  

## Not this

- Recooking a “smoother” dog (REUSE only)  
- RIFE on the composite to hide stepping  
- Speeding the sprite sheet past plate time  
- Using `lock/bolt-gallop-cycle-0.93s-prev.mp4` as the play cycle  

Sealed 2026-09-20 — gallop clock anti-saccadé. Canon cycle resealed same day: 6 s / 534 frames.
