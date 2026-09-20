# COLD START — GPU_VER 24 Frost KEEP (paste as first Build message)

You are hanging / porting **Frost Live** for Boltverse Odyssey. Read GitHub `main` first:

1. `biome/docs/00-PRIORITY0-any-biome.md`
2. `biome/docs/22-gpu24-frost-keep.md`  ← **this KEEP**. Not GPU_VER 20.
3. `biome/docs/20b-frost-aurora-proportions.md`
4. `biome/docs/17-live-compositor.md` (wire) then **override knobs from 22**

`21-paw-to-galaxy.md` is a different law. Do not confuse.

## Fixed
- Bolt = REUSE `lock/bolt-gallop-cycle.mp4` (6 s / 96 fps / 534). Never invent a gallop.
- Compositor = copy `biome/scripts/bolt-key-gl/bolt-key-gl.ts` (`GPU_VER = 24`) + `wet-fx.ts`.
- **FAIL** if you copy `bolt-key-gl-scissor-prev.ts`.
- **FAIL** if you `mix(c, plate, 0.10)` raw (neon through coat).
- **FAIL** if 5-tap body smear (`dy=0.0062`).
- **FAIL** if one body-ellipse shadow (hoverboard).
- Canvas `key={GPU_VER}`. Remount on bump.

## Frost knobs (do not retune by eye)
```
sat 0.54  bounce 0.42 bounceSrc  mix 0.11  edge 0.34*edge²
cool 0.84,0.93,1.12  under 0.70  rim 0.05,0.10,0.12
CONTACT_K 0.34  two paws  rx 0.36*pw  ry 0.20*pw
print 0.40,0.50,0.48  drop 0.48,0.94,0.70
MAX_PRINTS 10  MAX_DROPS 28  emit 7  reflectK 0.26 (0 in jump)
uSnow 0  uNeon 0.42  hemi sky chroma 0.42
PAW_PLANT 0.80  PAW_SINK 0.072  withersFrac ~0.10 KEEP
```

## Smoke
Sharp interior · no neon in the coat · two paw shadows · packed-snow prints · wet ice lower-third · back slightly cyan from aurora · no second dog · old Beat biomes still hung.
