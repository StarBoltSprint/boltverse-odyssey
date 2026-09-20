# bolt-key-gl — GPU compositor (PRIORITY 0, law 15)

Hung compositor: [`bolt-key-gl.ts`](bolt-key-gl.ts)  
Live wire: [`WIRE.md`](WIRE.md)  
Law: [`biome/docs/15-gpu-compositor.md`](../../docs/15-gpu-compositor.md)  
Kitchen paste: [`biome/docs/COLD_START-any-biome.md`](../../docs/COLD_START-any-biome.md) (supersedes [`COLD_START-gpu-6s.md`](../../docs/COLD_START-gpu-6s.md) for any biome)  
Any-biome: [`00-PRIORITY0-any-biome.md`](../../docs/00-PRIORITY0-any-biome.md) · FX [`16-biome-ground-fx.md`](../../docs/16-biome-ground-fx.md)

This folder is **reference + paste**, not a Live app. Do **not** scaffold `src/game/` / a lane-player tree here. Port `bolt-key-gl.ts` into Live as `src/game/bolt-key-gl.ts` (see WIRE.md).

## Canon cycle

`lock/bolt-gallop-cycle.mp4` **IS** the 6 s loop (same bytes as `lock/bolt-gallop-cycle-96fps-loop6s.mp4`).

```js
const CYCLE_FPS = 96;
const CYCLE_FRAMES = 534;
const STRIDES_PER_CYCLE = 22; // ≈ 4 Hz over ~5.56 s
```

Play: `bolt.loop = true`, `playbackRate = 1`. Never `currentTime` every rAF. Never cache 534 canvases.  
Old `lock/bolt-gallop-cycle-0.93s-prev.mp4` (89-frame) = **ARCHIVE — FAIL if used as play cycle**.

## GPU law

`makeCompositor(canvas)` **before** any `getContext("2d")`.  
Hot path: **zero** `getImageData` / `putImageData`.  
Two-pass OK: (1) road+shadow+grain fullscreen (2) chroma/despill/grade on Bolt rect only.  
Stage: Bolt **384×584**, road **360×640**. Native lock may stay 768×1168 on disk.  
Paw scan once (13d). After first alloc: `texSubImage2D`.
