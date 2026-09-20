# Wire GPU compositor (new Live / new Grok)

1. REUSE `lock/bolt-gallop-cycle.mp4` from Odyssey GitHub (6s / 534 / 96fps). Remux to `public/master/bolt.mp4` `-an` +faststart. Do **not** invent a gallop.
2. Copy `bolt-key-gl.ts` → `src/game/bolt-key-gl.ts` (adapt imports).
3. In player (`lane-player.tsx` or equivalent):
   - `const comp = makeCompositor(canvas)` **before** any `getContext("2d")` on that canvas.
   - If `comp.kind === "none"` → one-time CPU fallback; else GPU only.
   - Each rAF: update bolt video `currentTime` via gallop-clock / native loop 1×; `comp.draw({...})`.
4. Ban: `getImageData` / `putImageData` every frame; `*24` dog gate; 534-canvas harvest.
5. Scale via 13d (`bolt-scale`); shadow/grade in shader (13b / 13).

See `biome/docs/15-gpu-compositor.md`, `biome/docs/00-PRIORITY0-any-biome.md`, and cook paste `biome/docs/COLD_START-any-biome.md` (supersedes COLD_START-gpu-6s for any biome). FX table (16) is drawn in the GPU family.
