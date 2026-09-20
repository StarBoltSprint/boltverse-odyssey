# PRIORITY 0 — New Grok / new convo (Frost or any Lane biome)

**Cook paste superseded for any biome.** Use [`COLD_START-any-biome.md`](COLD_START-any-biome.md) as the Build first-message paste (GPU + sealed 6 s + biome-adaptive ground FX). This file stays the GPU + 6 s cycle kitchen note.

**Goal:** same white Bolt gallop as the sealed 6 s green cycle, composited with **GPU** (not CPU key).

## 1. Cycle (do not invent)
- REUSE GitHub `lock/bolt-gallop-cycle.mp4` (= 6 s loop): **5.56 s · 96 fps · 768×1168 · 534 frames · rear · `#00FF00`**
- Constants: `CYCLE_FPS=96`, `CYCLE_FRAMES=534`, `STRIDES_PER_CYCLE=22`
- Remux → Live `public/master/bolt.mp4` (`-an` +faststart), bump `?v=`
- `bolt.loop=true`, rate **1×**. Never seek every frame. Never cache 534 canvases.
- Archive `lock/bolt-gallop-cycle-0.93s-prev.mp4` = FAIL as play cycle.

## 2. Compositor = GPU from frame 0
- Copy `biome/scripts/bolt-key-gl/bolt-key-gl.ts` → Live `src/game/bolt-key-gl.ts` (see WIRE.md).
- `makeCompositor(canvas)` **before** any `getContext("2d")`. WebGL fail → CPU fallback once; else GPU only.
- Hot path: **zero** `getImageData` / `putImageData`.
- Two-pass OK: (1) road+shadow+grain fullscreen (2) chroma/despill/grade on Bolt rect only.
- Bolt tex every rAF; road tex only when plate frame changes. Stage Bolt 384×584, road 360×640.
- Paw/scale scan once (13d), not 60×/s.

## 3. Bans
- CPU chroma every rAF
- `*24` / 1-of-N on dog
- Inventing gallop / new angle
- Manual scale (use 13d)
- Wiping old biomes (hang ≠ wipe)

## 4. Keep
B-stack empty plate + cutout, A/D lanes + jump, cold grade + contact shadow, `PAW_PLANT≈0.8`, laws 13/13b/13c/13d/14/14c/15.

Attach this file + show `lock/bolt-gallop-cycle.mp4` in chat before coding.
