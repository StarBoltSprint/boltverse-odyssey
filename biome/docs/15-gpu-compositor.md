# 15 — GPU compositor (PRIORITY 0)

## Why
CPU chroma (`getImageData` / `putImageData` every rAF) drops frames on phone → 8–12 poses/sec → stop-motion gallop even when the sealed 96 fps cycle is correct.

## Hung compositor (Live, law 17)
- Source: [`biome/scripts/bolt-key-gl/bolt-key-gl.ts`](../scripts/bolt-key-gl/bolt-key-gl.ts)
- FX: [`biome/scripts/bolt-key-gl/wet-fx.ts`](../scripts/bolt-key-gl/wet-fx.ts)
- Wire: [`biome/scripts/bolt-key-gl/WIRE.md`](../scripts/bolt-key-gl/WIRE.md)
- **What actually worked:** [`17-live-compositor.md`](17-live-compositor.md)
- Kitchen paste: [`COLD_START-any-biome.md`](COLD_START-any-biome.md)
- Any-biome: [`00-PRIORITY0-any-biome.md`](00-PRIORITY0-any-biome.md)
- **ARCHIVE / FAIL to copy:** `bolt-key-gl-scissor-prev.ts` (scissor + IGN `fract(dot)` = vertical bars + eaten paws)

Copy `bolt-key-gl.ts` + `wet-fx.ts` → Live `src/game/`. Do **not** scaffold a Live tree in this recipe repo.

## Law
- Compositor = **WebGL** from first frame. `makeCompositor(canvas)` **before** any `getContext("2d")` on that canvas. WebGL fail → CPU fallback once; else GPU only.
- **True Bolt quad** at dest 13d (`uRect` NDC). **Never** fullscreen + `scissor`.
- Three-pass family: (1) road + contact shadow + **sin** grain fullscreen (2) FX quads (3) chroma / despill / grade / **plate bounce** on Bolt quad only.
- **Ground FX (law 16)** — `wet-fx.ts` quads, phase-lock to plant. Never CPU `getImageData`. Cap 16. Pick the row matching `{PAINT}`.
- Hot path: **zero** `getImageData` / `putImageData`.
- Bolt texture upload on **new rVFC mediaTime** (stamp). Plate upload only when plate frame (×24) changes. After first alloc: `texSubImage2D`. Direct `texImage2D` from `<video>` — no staging canvas.
- Native lock play: `loop=true`, rate **1×**. Never seek `currentTime` every rAF.
- Paw/stance scan **once** at boot (13d).
- Key: `greenness = G - max(R,B)` + luma protect. **No** sprite bottom fade.
- Grain: `fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453)`. **FAIL** = IGN `fract(dot)` without sin (bars).
- Plate bounce HARD (17 / 13b): sample road behind the dog.
- `GPU_VER` remount. `preserveDrawingBuffer: false`.

## Canon cycle (6 s)
- File: `lock/bolt-gallop-cycle.mp4` **IS** the 6 s loop (= `bolt-gallop-cycle-96fps-loop6s`)
- Spec: **~5.56 s · 96 fps · 768×1168 · 534 frames · rear white GSD · flat `#00FF00`**
- Constants: `CYCLE_FPS = 96`, `CYCLE_FRAMES = 534`, `STRIDES_PER_CYCLE = 22`
- Archive: `lock/bolt-gallop-cycle-0.93s-prev.mp4` — **do not REUSE as play cycle**.

## Bans
- CPU key every rAF
- Harvest / rVFC of all 534 frames into canvases (rVFC **stamp** is OK)
- Gate `*24` / 1-of-N on the dog
- Inventing a new gallop / angle
- Manual Bolt scale (use 13d)
- Scissor sketch / IGN-fract grain
- SPH / Box2D / general physics
- Wiping old biomes (hang ≠ wipe)

## Related
- 13 / 13b / 13c / 13d / 14 / 14c / 16 / **17**
- Hung code: `bolt-key-gl.ts` + `wet-fx.ts` + `WIRE.md`
