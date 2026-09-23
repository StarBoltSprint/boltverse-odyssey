Prefer [`COLD_START-biome-cook.md`](COLD_START-biome-cook.md) (`biome/scripts/biome-cook/README.md`) for the full ordered kit. This paste stays the any-biome parity brief.

# COLD START — cook any biome (paste as first Build message)

You are cooking a **Lane biome** for Boltverse Odyssey for a **random player**. Read GitHub `main` first:

1. `biome/docs/00-PRIORITY0-any-biome.md`
2. **`biome/docs/20-default-plate-proportions.md`** ← start empty still from the **full** law 20 measure set (not φ-only, not Frost-only): 3-lane ~0.75–0.82 · sky ~45% · plant ~0.80 · withersFrac ~0.10 KEEP · GPU start sat 0.54 / bounce 0.42 bounceSrc (law 22) / contact k 0.34 dual-paw. Player / `{PAINT}` may adapt. Frost aurora worked example = `20b-frost-aurora-proportions.md`.
2b. **`biome/docs/35-lane-materials.md`** ← **before** those stills, pick lane material A–D (Obsidian glass, Crystal quartz, Luminous ribbon, Mix vault) unless `{PAINT}` already names the road. **BAN** grey concrete asphalt / béton dashes / boring nationale as the silent default. Paste: `biome/docs/COLD_START-lane-materials.md`. Swap `{LANE_MATERIAL}`. Law 20 is the frame, not asphalt.
3. **`biome/docs/17-live-compositor.md`** ← what actually stuck Bolt to the plate. **FAIL** if you copy the old scissor/IGN sketch.
4. **`biome/docs/22-gpu24-frost-keep.md`** ← GPU_VER 24 KEEP. Neon-safe bounce, dual-paw contact, ice Fresnel, plate IBL. (`21-paw-to-galaxy.md` is a different law.) **FAIL** if you `mix(c, plate, 0.10)` raw or 5-tap-smear the body or draw one body-ellipse shadow.
5. `biome/docs/22-m-densify-snowball.md` ← **`m` = momentum.** Success → next plate all prior `@` refs + 1 new (richer, ≤12). Miss → −1. **d1+ always ≥1 spectacular hazard** (law 25). Paste: `biome/docs/COLD_START-m-densify.md`. (`22-gpu24-frost-keep.md` stays GPU KEEP.)
6. **`biome/docs/23-plate-geo-qc.md`** ← run `python3 biome/scripts/plate-geo-qc/plate-geo-qc.py <plate.mp4>` **before hang**. FAIL = recook. Paste: `biome/docs/COLD_START-geo-qc.md`.
7. **`biome/docs/24-camera-1point.md`** ← sprint = conical 1-point lock-off. Paste `biome/prompts/camera-1point.txt` into Imagine. Not 2-point / 3-point on Video A. Paste: `biome/docs/COLD_START-camera.md`.
8. **`biome/docs/25-hazard-cone.md`** ← danger rides one lane ray, never a 3-lane wall. `python3 biome/scripts/plate-hazard-qc/plate-hazard-qc.py --ref <empty.mp4> --expect 1 <dN.mp4>` before hang. Paste: `biome/docs/COLD_START-hazard.md`.
9. **`biome/docs/26-biome-sprint-plan.md`** ← **write the 10-plate cinematic plan BEFORE d1.** Frost: `26b-frost-sprint-plan.md` + `plans/frost-sprint.md`. Paste: `biome/docs/COLD_START-sprint-plan.md`. GPU Howl column = law 32 (Prismwake names targets; Frost cells stay —).
10. **`biome/docs/32-howl-gpu-targets.md`** ← rail A dodge (law 25) vs rail B keyed Howl targets. Shatter per type. Howl = **REUSE** `biome/fx/howl/howl-attack.mp4` (SmiR KEEP). Vertical rings, birth narrow → wider, locked cam, black key, no baked shatter. Paste: `biome/docs/COLD_START-howl-gpu.md`.
11. **`biome/docs/33-plate-mae-qc.md`** ← `python3 biome/scripts/plate-mae-qc/plate-mae-qc.py <N.mp4> <N+1.mp4>` before hang. Exit non-zero = FAIL. Paste: `biome/docs/COLD_START-plate-mae.md`.

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
- Biome name + `{PAINT}` for empty plate + hazards. `{PAINT}` includes `{LANE_MATERIAL}` from law 35 (menu A–D unless the paint already names a road). Empty still **starts** from the **full** law 20 set (3-lane ~0.75–0.82, sky ~45%, horizon ~0.38, plant ~0.80, Bolt X = 0.50, withersFrac ~0.10, GPU sat/bounce/contact above) unless the player asked a different framing. Grey concrete is not the silent road.
- FX row + `uniformsFor(chap)` from docs 16 / 17 matching the paint.
- New files `road-<biome>*.mp4` — do not wipe canyon→war.

## Order
Teacher gate → **lane material (law 35)** → **empty still from law 20 defaults** → Video A (extract last frame → cook last still → session Imagine Video first+last, or CLI if `XAI_API_KEY` is set) → **law 23 geo qc PASS** → REUSE cycle → key/despill (luma protect) → scale → GPU wire (law 17) → clock → grade+bounce+shadow+FX row → hazards (law 25, dodge) → Howl targets only if the plan names them (law 32) → **law 33 seam PASS** vs previous plate → hang+Pack → smoke.

## Smoke
Sprint looks like Frost-parity on **this** plate: fluid gallop, **sharp interior**, hind paws intact, no vertical bars, **no neon through the coat**, plate light (not studio), paw shadow (no skateboard), biome-correct ground FX, old biomes still hung.

**FAIL** if: invent sprint · CPU key every rAF · copy scissor/IGN sketch · wipe masters · skip bounce · skip FX row · bake Bolt into road mp4 · SPH · ice-hole / Beat-narrow road as silent default · grow Bolt to fake withersMin on a wide road · raw plate mix into coat · 5-tap body smear · dark frost prints · hang a plate the geo qc FAILed · shader a Howl · bake shatter into the Howl · hang a seam the MAE qc FAILed · stop because `XAI_API_KEY` is unset · one-still I2V · “forcé localement” · claim MAE PASS without `plate-mae-qc.py`.
