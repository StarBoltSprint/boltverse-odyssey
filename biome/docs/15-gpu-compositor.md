# 15 — GPU compositor (PRIORITY 0)

## Why
CPU chroma (`getImageData` / `putImageData` every rAF) drops frames on phone → 8–12 poses/sec → stop-motion gallop even when the sealed 96 fps cycle is correct.

## Hung compositor
- Source: [`biome/scripts/bolt-key-gl/bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts)
- Wire: [`biome/scripts/bolt-key-gl/WIRE.md`](../scripts/bolt-key-gl/WIRE.md)
- Kitchen paste for **any biome:** [`COLD_START-any-biome.md`](COLD_START-any-biome.md) (supersedes [`COLD_START-gpu-6s.md`](COLD_START-gpu-6s.md) as the cook paste)
- Any-biome PRIORITY 0: [`00-PRIORITY0-any-biome.md`](00-PRIORITY0-any-biome.md)

Copy `bolt-key-gl.ts` → Live `src/game/bolt-key-gl.ts` (adapt imports). Do **not** scaffold a Live tree in this recipe repo.

## Law
- Compositor = **WebGL** from first frame. `makeCompositor(canvas)` **before** any `getContext("2d")` on that canvas. WebGL fail → CPU fallback once; else GPU only.
- Two-pass OK: (1) road + contact shadow + grain fullscreen (2) chroma / despill / grade on Bolt rect only.
- **Ground FX (law 16)** — paw prints / splash / dust from [`16-biome-ground-fx.md`](16-biome-ground-fx.md) are drawn in this **same GPU family** (same pass or a cheap overlay). Phase-lock to plant frames. Never CPU `getImageData`. Cap active FX. Pick the row matching `{PAINT}` — frost splash ≠ ember ash ≠ tide water.
- Hot path: **zero** `getImageData` / `putImageData`. Shader does: road sample → contact shadow (13b) → chroma `greenness = G - max(R,B)` + despill → plate grade (13 / 16) → grain. FX sprites/blobs in the same family.
- Bolt texture upload **every rAF**. Plate upload only when plate frame (×24) changes.
- Stage sizes: Bolt **384×584**, road **360×640** (GPU scales). Native lock can stay 768×1168 on disk.
- Paw/stance scan **once** at boot (13d), not 60×/s.
- After first alloc use `texSubImage2D`, do not recreate textures each frame.

## Canon cycle (6 s)
- File: `lock/bolt-gallop-cycle.mp4` **IS** the 6 s loop (= `bolt-gallop-cycle-96fps-loop6s`)
- Spec: **~5.56 s · 96 fps · 768×1168 · 534 frames · rear white GSD · flat `#00FF00`**
- Constants: `CYCLE_FPS = 96`, `CYCLE_FRAMES = 534`, `STRIDES_PER_CYCLE = 22`
- Play: `bolt.loop = true`, rate **1×**. Never seek every frame. Never cache 534 canvases.
- Archive: `lock/bolt-gallop-cycle-0.93s-prev.mp4` (old 89-frame lock) — **do not REUSE as play cycle**.

## Bans
- CPU key every rAF (`getImageData` / `putImageData` hot path)
- Harvest / rVFC of all 534 frames into canvases
- Gate `*24` / 1-of-N on the dog
- Inventing a new gallop / angle
- Manual Bolt scale (use 13d)
- Wiping old biomes (hang ≠ wipe)

## Related
- 13 / 13b / 13c / 13d / 14 / 14c / 16
- [`00-PRIORITY0-any-biome.md`](00-PRIORITY0-any-biome.md) · [`16-biome-ground-fx.md`](16-biome-ground-fx.md) · [`COLD_START-any-biome.md`](COLD_START-any-biome.md)
- `biome/scripts/gallop-clock/`, `biome/scripts/bolt-scale/`
- Hung code: [`biome/scripts/bolt-key-gl/bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts) + [`WIRE.md`](../scripts/bolt-key-gl/WIRE.md)
