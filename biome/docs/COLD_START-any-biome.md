# COLD START — cook any biome (paste as first Build message)

You are cooking a **Lane biome** for Boltverse Odyssey for a **random player**. Read GitHub `main` first:

1. `biome/docs/00-PRIORITY0-any-biome.md`
2. **`biome/docs/20-default-plate-proportions.md`** ← start empty still from law 20 defaults (any biome, not Frost-only). Player may override. Frost aurora KEEP numbers = `20b-frost-aurora-proportions.md`.
3. **`biome/docs/17-live-compositor.md`** ← what actually stuck Bolt to the plate. **FAIL** if you copy the old scissor/IGN sketch.

## Fixed
- Bolt motion = REUSE `lock/bolt-gallop-cycle.mp4` (**6 s / 96 fps / 534 frames / green / rear**). Remux → `public/master/bolt.mp4`. Never invent a gallop. Never use `lock/bolt-gallop-cycle-0.93s-prev.mp4` as play.
- Style teacher = `lock/bolt-back.jpg` (show in chat).
- Compositor = **GPU from frame 0**: copy `biome/scripts/bolt-key-gl/bolt-key-gl.ts` **and** `wet-fx.ts` → `src/game/`. Wire per `WIRE.md` + **law 17**.
  - Quad at dest 13d — **not** scissor.
  - Key: `greenness=G-max(R,B)` hard 0.157/0.063 + **luma protect <0.14**. **No** `py>0.90` fade.
  - Grain: `fract(sin(dot(...)*43758.54))` — **never** IGN `fract(dot)` (vertical bars).
  - Plate bounce HARD: sample `uPlate` behind the dog (`*0.32` bounce + `mix 0.10`).
  - Upload: `texImage2D` from `<video>`. rVFC = stamp, not harvest. Road gated ×24. Native loop 1×.
  - `GPU_VER` remount. `preserveDrawingBuffer:false`.
- Scale = 13d `bolt-scale`. Clock = 14c `gallop-clock`. Contact shadow = 13b (multiply on **road**).
- Ground FX = `wet-fx.ts` + table in `biome/docs/16-biome-ground-fx.md` (**adapt to this biome** — frost splash ≠ ember ash ≠ tide water). Euler quads. Not SPH. Not Box2D. Cap 16. Prints **slide with the road** toward camera.
- Hang ≠ wipe. Pack auto-embed (`BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` + pack.js).

## Variable
- Biome name + `{PAINT}` for empty plate + hazards. Empty still **starts** from law 20 (wide 3-lane, horizon ~0.38, plant ~0.80, Bolt X = 0.50) unless the player asked a different framing.
- FX row + `uniformsFor(chap)` from docs 16 / 17 matching the paint.
- New files `road-<biome>*.mp4` — do not wipe canyon→war.

## Order
Teacher gate → **empty still from law 20 defaults** → empty A 48fps → REUSE cycle → key/despill (luma protect) → scale → GPU wire (law 17) → clock → grade+bounce+shadow+FX row → hazards → hang+Pack → smoke.

## Smoke
Sprint looks like Frost-parity on **this** plate: fluid gallop, hind paws intact, no vertical bars, plate light (not studio), paw shadow, biome-correct ground FX, old biomes still hung.

**FAIL** if: invent sprint · CPU key every rAF · copy scissor/IGN sketch · wipe masters · skip bounce · skip FX row · bake Bolt into road mp4 · SPH · ice-hole / Beat-narrow road as silent default · grow Bolt to fake withersMin on a wide road.
