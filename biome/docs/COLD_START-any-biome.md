# COLD START — cook any biome (paste as first Build message)

You are cooking a **Lane biome** for Boltverse Odyssey for a **random player**. Read GitHub `main` first:

1. `biome/docs/00-PRIORITY0-any-biome.md`
2. **`biome/docs/20-default-plate-proportions.md`** ← start empty still from the **full** law 20 measure set (not φ-only, not Frost-only): 3-lane ~0.75–0.82 · sky ~45% · plant ~0.80 · withersFrac ~0.10 KEEP · GPU start sat 0.54 / bounce 0.42 bounceSrc (law 22) / contact k 0.34 dual-paw. Player / `{PAINT}` may adapt. Frost aurora worked example = `20b-frost-aurora-proportions.md`.
3. **`biome/docs/17-live-compositor.md`** ← what actually stuck Bolt to the plate. **FAIL** if you copy the old scissor/IGN sketch.
4. **`biome/docs/22-gpu24-frost-keep.md`** ← GPU_VER 24 KEEP. Neon-safe bounce, dual-paw contact, ice Fresnel, plate IBL. (`21-paw-to-galaxy.md` is a different law.) **FAIL** if you `mix(c, plate, 0.10)` raw or 5-tap-smear the body or draw one body-ellipse shadow.

## Fixed
- Bolt motion = REUSE `lock/bolt-gallop-cycle.mp4` (**6 s / 96 fps / 534 frames / green / rear**). Remux → `public/master/bolt.mp4`. Never invent a gallop. Never use `lock/bolt-gallop-cycle-0.93s-prev.mp4` as play.
- Style teacher = `lock/bolt-back.jpg` (show in chat).
- Compositor = **GPU from frame 0**: copy `biome/scripts/bolt-key-gl/bolt-key-gl.ts` **and** `wet-fx.ts` → `src/game/`. Wire per `WIRE.md` + **law 17**.
  - Quad at dest 13d — **not** scissor.
  - Key: `greenness=G-max(R,B)` hard 0.157/0.063 + **luma protect <0.14**. **No** `py>0.90` fade.
  - Grain: `fract(sin(dot(...)*43758.54))` — **never** IGN `fract(dot)` (vertical bars).
  - Plate bounce HARD (law 22): 3-tap neighborhood, **neonM chroma-kill**, bounce **0.42** on `bounceSrc`, interior mix **0.11 bounceSrc** (NOT raw plate). sat frost **0.54**. contact `k` **0.34 dual-paw**. Prints frost `[0.40, 0.50, 0.48]`. Smear 3-tap `dy=0.0030` **edge only** (`cSharp = k0.rgb` straight — never `/ a`). `GPU_VER = 24`. Then `uniformsFor(chap)` may adapt. Old raw `mix(c, plate, 0.10)` / 5-tap body / print RGB 0.08 = FAIL.
  - Upload: `texImage2D` from `<video>`. rVFC = stamp, not harvest. Road gated ×24. Native loop 1×.
  - `GPU_VER` remount. `preserveDrawingBuffer:false`.
- Scale = 13d `bolt-scale`. On the law-20 wide road, **withersFrac ~0.10 is KEEP** — do not grow Bolt to 0.22. Clock = 14c `gallop-clock`. Contact shadow = 13b + law 22 (two paw gaussians on **road**, `k` 0.34).
- Ground FX = `wet-fx.ts` + table in `biome/docs/16-biome-ground-fx.md` (**adapt to this biome** — frost splash ≠ ember ash ≠ tide water). Euler quads. Not SPH. Not Box2D. Cap 28 drops / 10 prints (law 22). Prints **slide with the road** toward camera.
- Hang ≠ wipe. Pack auto-embed (`BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` + pack.js).

## Variable
- Biome name + `{PAINT}` for empty plate + hazards. Empty still **starts** from the **full** law 20 set (3-lane ~0.75–0.82, sky ~45%, horizon ~0.38, plant ~0.80, Bolt X = 0.50, withersFrac ~0.10, GPU sat/bounce/contact above) unless the player asked a different framing.
- FX row + `uniformsFor(chap)` from docs 16 / 17 matching the paint.
- New files `road-<biome>*.mp4` — do not wipe canyon→war.

## Order
Teacher gate → **empty still from law 20 defaults** → empty A 48fps → REUSE cycle → key/despill (luma protect) → scale → GPU wire (law 17) → clock → grade+bounce+shadow+FX row → hazards → hang+Pack → smoke.

## Smoke
Sprint looks like Frost-parity on **this** plate: fluid gallop, **sharp interior**, hind paws intact, no vertical bars, **no neon through the coat**, plate light (not studio), paw shadow (no skateboard), biome-correct ground FX, old biomes still hung.

**FAIL** if: invent sprint · CPU key every rAF · copy scissor/IGN sketch · wipe masters · skip bounce · skip FX row · bake Bolt into road mp4 · SPH · ice-hole / Beat-narrow road as silent default · grow Bolt to fake withersMin on a wide road · raw plate mix into coat · 5-tap body smear · dark frost prints.
