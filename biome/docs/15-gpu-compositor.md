# 15 — GPU compositor (PRIORITY 0)

## Why
CPU chroma (`getImageData` / `putImageData` every rAF) drops frames on phone → 8–12 poses/sec → stop-motion gallop even when the sealed 96 fps cycle is correct.

## Law
- Compositor = **WebGL one-pass** from first frame. Files in a Live: `bolt-key-gl.ts` + wire in `lane-player.tsx` (`makeCompositor` before any `getContext("2d")`). WebGL fail → CPU fallback once; else GPU only.
- Hot path: **zero** `getImageData`. Shader does: road sample → contact shadow (13b) → chroma `greenness = G - max(R,B)` + despill → cold grade (13) → grain.
- Bolt texture upload **every rAF**. Plate upload only when plate frame (×24) changes.
- Stage sizes: Bolt **384×584**, road **360×640** (GPU scales). Native lock can stay 768×1168 on disk.
- Paw/stance scan **once** at boot (13d), not 60×/s.
- After first alloc use `texSubImage2D`, do not recreate textures each frame.

## Canon cycle (6 s)
- File: `lock/bolt-gallop-cycle.mp4` (= `bolt-gallop-cycle-96fps-loop6s`)
- Spec: **~5.56 s · 96 fps · 768×1168 · 534 frames · rear white GSD · flat `#00FF00`**
- Constants: `CYCLE_FPS = 96`, `CYCLE_FRAMES = 534`, `STRIDES_PER_CYCLE = 22`
- Play: `bolt.loop = true`, rate **1×**. Never seek every frame. Never cache 534 canvases.
- Archive: `lock/bolt-gallop-cycle-0.93s-prev.mp4` (old 89-frame lock) — **do not REUSE as play cycle**.

## Bans
- CPU key every rAF
- Harvest / rVFC of all 534 frames into canvases
- Gate `*24` / 1-of-N on the dog
- Inventing a new gallop / angle
- Manual Bolt scale (use 13d)

## Related
- 13 / 13b / 13c / 13d / 14 / 14c
- `biome/scripts/gallop-clock/`, `biome/scripts/bolt-scale/`
- Constants paste: `biome/scripts/bolt-key-gl/README.md` (not a Live app)
