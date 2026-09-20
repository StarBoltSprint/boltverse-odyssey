# COLD START — cook any biome (paste as first Build message)

You are cooking a **Lane biome** for Boltverse Odyssey for a **random player**. Read GitHub `main` first: `biome/docs/00-PRIORITY0-any-biome.md`.

## Fixed
- Bolt motion = REUSE `lock/bolt-gallop-cycle.mp4` (**6 s / 96 fps / 534 frames / green / rear**). Remux → `public/master/bolt.mp4`. Never invent a gallop. Never use `lock/bolt-gallop-cycle-0.93s-prev.mp4` as play.
- Style teacher = `lock/bolt-back.jpg` (show in chat).
- Compositor = **GPU** from frame 0: copy `biome/scripts/bolt-key-gl/bolt-key-gl.ts` → `src/game/`, wire per `WIRE.md`. Ban `getImageData` / `putImageData` every rAF.
- Scale = 13d `bolt-scale`. Clock = 14c `gallop-clock`. Contact shadow = 13b.
- Ground FX + grade = table in `biome/docs/16-biome-ground-fx.md` (**adapt to this biome** — frost splash ≠ ember ash ≠ tide water).
- Hang ≠ wipe. Pack auto-embed (`BOLTVERSE_PACK_ORIGIN=https://boltverse-pack.vercel.app` + pack.js).

## Variable
- Biome name + `{PAINT}` for empty plate + hazards.
- FX row from doc 16 matching the paint.
- New files `road-<biome>*.mp4` — do not wipe canyon→war.

## Order
Teacher gate → empty A 48fps → REUSE cycle → key/despill → scale → GPU wire → clock → grade+shadow+FX row → hazards → hang+Pack → smoke.

## Done when
Sprint looks like Frost-parity on **this** plate: fluid gallop, correct scale, plate light, paw shadow, biome-correct ground FX, old biomes still hung.
