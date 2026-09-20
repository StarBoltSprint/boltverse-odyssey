# bolt-key-gl — GPU compositor constants (reference)

Law: [`biome/docs/15-gpu-compositor.md`](../../docs/15-gpu-compositor.md).  
This folder is **constants + paste**, not a Live app. Do **not** scaffold `src/game/` / a lane-player tree here.

## Canon cycle

`lock/bolt-gallop-cycle.mp4` **IS** the 6 s loop (same bytes as `lock/bolt-gallop-cycle-96fps-loop6s.mp4`).

```js
const CYCLE_FPS = 96;
const CYCLE_FRAMES = 534;
const STRIDES_PER_CYCLE = 22; // ≈ 4 Hz over ~5.56 s
```

Play: `bolt.loop = true`, `playbackRate = 1`. Never `currentTime` every rAF. Never cache 534 canvases.  
Old `lock/bolt-gallop-cycle-0.93s-prev.mp4` (89-frame) = **ARCHIVE — FAIL if used as play cycle**.

## Live implement (elsewhere)

WebGL one-pass from frame 0 (`bolt-key-gl` pattern). Ban `getImageData` on the hot path.  
Stage: Bolt **384×584**, road **360×640**. Native lock may stay 768×1168 on disk.  
Paw scan once (13d). After first alloc: `texSubImage2D`.
