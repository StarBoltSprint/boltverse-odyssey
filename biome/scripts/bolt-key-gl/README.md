# bolt-key-gl — GPU compositor (PRIORITY 0, law 15 + **17** + **22**)

Hung compositor: [`bolt-key-gl.ts`](bolt-key-gl.ts) (`GPU_VER = 24`)  
FX: [`wet-fx.ts`](wet-fx.ts) (`MAX_PRINTS 10` · `MAX_DROPS 28`)  
Live wire: [`WIRE.md`](WIRE.md)  
**KEEP:** [`biome/docs/22-gpu24-frost-keep.md`](../../docs/22-gpu24-frost-keep.md)  
**What actually worked:** [`biome/docs/17-live-compositor.md`](../../docs/17-live-compositor.md)  
Law 15: [`biome/docs/15-gpu-compositor.md`](../../docs/15-gpu-compositor.md)  
FX table: [`16-biome-ground-fx.md`](../../docs/16-biome-ground-fx.md)  
Kitchen paste: [`biome/docs/COLD_START-gpu24.md`](../../docs/COLD_START-gpu24.md) · [`COLD_START-any-biome.md`](../../docs/COLD_START-any-biome.md) (supersedes [`COLD_START-gpu-6s.md`](../../docs/COLD_START-gpu-6s.md))  
Any-biome: [`00-PRIORITY0-any-biome.md`](../../docs/00-PRIORITY0-any-biome.md)

This folder is **reference + paste**, not a Live app. Do **not** scaffold `src/game/` / a lane-player tree here. Port **both** `bolt-key-gl.ts` and `wet-fx.ts` into Live as `src/game/` (see WIRE.md).

**ARCHIVE / FAIL to copy:** [`bolt-key-gl-scissor-prev.ts`](bolt-key-gl-scissor-prev.ts) — scissor + IGN `fract(dot)` = vertical bars + eaten hind paws + sticker.

## Canon cycle

`lock/bolt-gallop-cycle.mp4` **IS** the 6 s loop (same bytes as `lock/bolt-gallop-cycle-96fps-loop6s.mp4`).

```js
const CYCLE_FPS = 96;
const CYCLE_FRAMES = 534;
const STRIDES_PER_CYCLE = 22; // ≈ 4 Hz over ~5.56 s
```

Play: `bolt.loop = true`, `playbackRate = 1`. Never `currentTime` every rAF. Never cache 534 canvases.  
Old `lock/bolt-gallop-cycle-0.93s-prev.mp4` (89-frame) = **ARCHIVE — FAIL if used as play cycle**.

## GPU law (17 + 22)

`makeCompositor(canvas)` **before** any `getContext("2d")`. Canvas `key={GPU_VER}`.  
Hot path: **zero** `getImageData` / `putImageData`.  
Five-pass family: (1) road+neon+Fresnel+dual-paw shadow+sin grain (2) prints DST_COLOR (3) drops additive (4) Bolt mirror (5) Bolt quad. **Never** fullscreen + `scissor`.  
Key: `greenness = G-max(R,B)` hard 0.157/0.063 + **luma protect <0.14**. Paw hold `py>0.90` α×0.78 — **not** a fade-to-zero.  
Grain: `fract(sin(dot(...)*43758.54))` — **FAIL** = IGN `fract(dot)`.  
Bounce: neon-stripped `bounceSrc`. **FAIL** = raw `mix(c, plate)`.  
Smear: 3-tap `dy=0.0030` **edge only**. **FAIL** = 5-tap body.  
Upload: direct `texImage2D` from `<video>`. rVFC = **stamp**, not harvest. Road gated ×48. After first alloc: `texSubImage2D`.  
`preserveDrawingBuffer: false`. Paw scan once (13d).  
Ban: SPH / Box2D / bake Bolt into road mp4.