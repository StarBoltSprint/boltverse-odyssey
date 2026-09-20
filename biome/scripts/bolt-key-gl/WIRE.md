# Wire GPU compositor (new Live / new Grok)

**Law 17 is the Live file.** Do **not** resurrect the scissor / IGN-fract sketch (`bolt-key-gl-scissor-prev.ts`).

1. REUSE `lock/bolt-gallop-cycle.mp4` (6s / 534 / 96fps). Remux → `public/master/bolt.mp4` `-an` +faststart. Never invent a gallop. Never play the 0.93s archive.
2. Copy **both**:
   - `bolt-key-gl.ts` → `src/game/bolt-key-gl.ts`
   - `wet-fx.ts` → `src/game/wet-fx.ts` (or inline next to the player)
3. `const gpu = makeCompositor(canvas)` **before** any `getContext("2d")` on that canvas.
4. Canvas `key={GPU_VER}`. On version bump, `destroy()` old compositor then remake.
5. Play: `bolt.loop = true`, `playbackRate = 1`. **Never** `currentTime =` every rAF. rVFC = **stamp only** (which frame is new). Do **not** harvest 534 canvases.
6. `gpu.frame({ road, bolt, dest, shadow, prints, drops, chap, ... })`
   - `dest` = 13d plant rect (quad, not scissor)
   - `chap` selects `uniformsFor` (frost ≠ ember ≠ tide)
   - `prints` / `drops` = `packWet` from `wet-fx.ts`, spawn on plant
7. Ban: `getImageData` / `putImageData` hot path · `*24` on the dog · fade `py>0.90` · SPH / Box2D · IGN `fract(dot)` grain.

See `biome/docs/17-live-compositor.md` (what actually worked) · `22` (GPU_VER 24 KEEP) · `15` · `16` · `00-PRIORITY0-any-biome.md` · paste `COLD_START-any-biome.md` / `COLD_START-gpu24.md`.

**GPU_VER 24 / law 22.** Copy this file’s sibling `bolt-key-gl.ts` (`export const GPU_VER = 24`). Neon-safe bounce, dual-paw contact, ice Fresnel, plate IBL, edge-only smear, straight-over blend. Doc: [../../docs/22-gpu24-frost-keep.md](../../docs/22-gpu24-frost-keep.md). `21-paw-to-galaxy.md` is a different law.
